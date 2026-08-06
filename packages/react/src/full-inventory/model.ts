import type {
  InventoryKind,
  InventoryDecisionRecord,
  InventoryFindingRecord,
  InventoryInputRecord,
  InventoryInsightRecord,
  InventoryOutputRecord,
  InventoryRecord,
  InventoryScope,
  InventorySnapshot,
} from './types.js';
import {
  createProjectViewModelIndex,
  type ProjectRecordView,
  type ProjectViewModelIndex,
  type ProjectViewModelV1,
  type RuntimeOverlayV1,
} from '@lightcone-research/astra-viewer-model';

/** Return cited insight ids with the selected option first, then alternatives. */
export function decisionEvidenceIds(
  decision: Pick<InventoryRecord, 'selected' | 'option_insights'>,
): string[] {
  const { selected, option_insights: byOption = {} } = decision;
  const ordered = [
    ...(selected ? byOption[selected] ?? [] : []),
    ...Object.entries(byOption)
      .filter(([optionId]) => optionId !== selected)
      .flatMap(([, ids]) => ids ?? []),
  ];
  return [...new Set(ordered)];
}

export interface LocatedInventoryRecord {
  record: InventoryRecord;
  scope: InventoryScope;
}

interface InventoryRecordByKind {
  input: InventoryInputRecord;
  decision: InventoryDecisionRecord;
  output: InventoryOutputRecord;
  finding: InventoryFindingRecord;
  prior_insight: InventoryInsightRecord;
}

export type InventoryRecordForKind<
  Kind extends keyof InventoryRecordByKind,
> = InventoryRecordByKind[Kind];

/**
 * Read-only indexes over one inventory snapshot. Components receive this model
 * instead of repeatedly scanning every scope for the same records.
 */
export interface InventoryModel {
  snapshot: InventorySnapshot;
  scopeById: ReadonlyMap<string, InventoryScope>;
  scopeByPath: ReadonlyMap<string, InventoryScope>;
  recordByPath: ReadonlyMap<string, LocatedInventoryRecord>;
  recordsById: ReadonlyMap<string, readonly LocatedInventoryRecord[]>;
}

function isProjectViewModelIndex(
  source: InventorySnapshot | ProjectViewModelV1 | ProjectViewModelIndex,
): source is ProjectViewModelIndex {
  return 'model' in source && 'recordById' in source;
}

function isProjectViewModel(
  source: InventorySnapshot | ProjectViewModelV1 | ProjectViewModelIndex,
): source is ProjectViewModelV1 {
  return 'schemaVersion' in source
    && source.schemaVersion === 'project-view-model.v1';
}

function relatedRecord(
  index: ProjectViewModelIndex,
  targetRecordId: string,
): ProjectRecordView | undefined {
  return index.recordById.get(targetRecordId)
    ?? index.recordByPath.get(targetRecordId)?.record;
}

function presentationRecord(
  index: ProjectViewModelIndex,
  record: ProjectRecordView,
): InventoryRecord {
  const common = {
    modelId: record.id,
    id: record.localId,
    path: record.canonicalPath,
    kind: record.kind,
    ...(record.label ? { label: record.label } : {}),
    ...(record.description ? { description: record.description } : {}),
    ...(record.tags ? { tags: record.tags } : {}),
    ...(record.active !== undefined ? { active: record.active } : {}),
  };

  if (record.kind === 'input') {
    const alias = record.relations
      .filter((relation) => relation.kind === 'aliases')
      .map((relation) => relatedRecord(index, relation.targetRecordId))
      .find(Boolean);
    return {
      ...common,
      kind: 'input',
      ...(record.inputType ? { type: record.inputType } : {}),
      ...(record.source ? { source: record.source } : {}),
      ...(record.reference ? { ref: record.reference } : {}),
      ...(alias ? { from: alias.canonicalPath } : {}),
    };
  }

  if (record.kind === 'decision') {
    return {
      ...common,
      kind: 'decision',
      ...(record.selectedOptionId ? { selected: record.selectedOptionId } : {}),
      options: Object.fromEntries(
        record.options.map((option) => [option.id, option.label]),
      ),
      option_insights: Object.fromEntries(
        record.options
          .filter((option) => option.insightRecordIds?.length)
          .map((option) => [
            option.id,
            option.insightRecordIds!.map((recordId) =>
              relatedRecord(index, recordId)?.canonicalPath ?? recordId),
          ]),
      ),
      ...(record.rationale ? { rationale: record.rationale } : {}),
    };
  }

  if (record.kind === 'output') {
    const alias = record.relations
      .filter((relation) => relation.kind === 'aliases')
      .map((relation) => relatedRecord(index, relation.targetRecordId))
      .find(Boolean);
    const resources = record.resourceIds
      .map((resourceId) => index.resourceById.get(resourceId))
      .filter((resource) => Boolean(resource));
    const primaryResource = resources[0];
    return {
      ...common,
      kind: 'output',
      type: record.outputType,
      ...(alias ? { from: alias.canonicalPath } : {}),
      ...(record.recipe ? { recipe: record.recipe } : {}),
      inputs: record.provenance.inputs
        .filter((reference) => reference.direct)
        .map((reference) =>
          (reference.recordId
            ? relatedRecord(index, reference.recordId)?.canonicalPath
            : undefined)
          ?? reference.reference),
      inputs_root: record.provenance.inputs
        .filter((reference) => !reference.direct)
        .map((reference) => {
          const target = reference.recordId
            ? relatedRecord(index, reference.recordId)
            : undefined;
          return {
            id: target?.canonicalPath ?? reference.reference,
            ...(reference.label
              ? { label: reference.label }
              : target
                ? { label: target.label ?? target.localId }
                : {}),
          };
        }),
      decisions: record.provenance.decisions
        .filter((reference) => reference.direct)
        .map((reference) =>
          (reference.recordId
            ? relatedRecord(index, reference.recordId)?.canonicalPath
            : undefined)
          ?? reference.reference),
      decisions_transitive: record.provenance.decisions.map((reference) => {
        const target = reference.recordId
          ? relatedRecord(index, reference.recordId)
          : undefined;
        const scope = target ? index.scopeById.get(target.scopeId) : undefined;
        return {
          id: target?.canonicalPath ?? reference.reference,
          ...(reference.label
            ? { label: reference.label }
            : target
              ? { label: target.label ?? target.localId }
              : {}),
          ...(reference.scopeId
            ? { via: reference.scopeId }
            : scope
              ? { via: scope.id }
              : {}),
          ...(reference.selection
            ? { selection: reference.selection }
            : target?.kind === 'decision' && target.selectedOptionId
              ? { selection: target.selectedOptionId }
              : {}),
        };
      }),
      resourceIds: [...record.resourceIds],
      ...(primaryResource?.fileName
        ? { resolved_path: primaryResource.fileName }
        : {}),
      ...(record.metric ? { metric: record.metric } : {}),
    };
  }

  const evidence = record.evidence.map((item) => {
    const artifact = item.artifactRecordId
      ? relatedRecord(index, item.artifactRecordId)
      : undefined;
    return {
      ...(item.artifactRecordId
        ? { artifact: artifact?.canonicalPath ?? item.artifactRecordId }
        : {}),
      ...(item.doi ? { doi: item.doi } : {}),
      ...(item.quote ? { quote: item.quote } : {}),
      ...(item.page !== undefined ? { page: item.page } : {}),
    };
  });
  const firstSource = evidence.find((item) => item.doi || item.quote);
  return {
    ...common,
    kind: record.kind,
    ...(record.claim ? { claim: record.claim } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    evidence,
    ...(firstSource?.doi ? { doi: firstSource.doi } : {}),
    ...(firstSource?.quote ? { quote: firstSource.quote } : {}),
    ...(firstSource?.page !== undefined ? { page: firstSource.page } : {}),
  };
}

/**
 * Project the canonical, host-neutral model into the convenience shape used by
 * the rich inventory presentation. This is a React-layer view model: hosts do
 * not construct or transport it.
 */
export function inventorySnapshotFromProjectModel(
  source: ProjectViewModelV1 | ProjectViewModelIndex,
  runtime?: RuntimeOverlayV1,
): InventorySnapshot {
  const index = isProjectViewModelIndex(source)
    ? source
    : createProjectViewModelIndex(source, runtime);
  return {
    version: 1,
    analysis: {
      id: index.model.project.id,
      name: index.model.project.name,
      ...(index.model.project.description
        ? { description: index.model.project.description }
        : {}),
    },
    scopes: index.model.scopes.map((scope) => ({
      id: scope.id,
      path: scope.canonicalPath === 'root' ? '' : scope.canonicalPath,
      name: scope.name,
      ...(scope.parentId ? { parent: scope.parentId } : {}),
      children: [...scope.childIds],
      records: scope.recordIds
        .map((recordId) => index.recordById.get(recordId))
        .filter((record): record is ProjectRecordView => Boolean(record))
        .map((record) => presentationRecord(index, record)),
    })),
    diagnostics: index.model.diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.canonicalPath ? { path: diagnostic.canonicalPath } : {}),
    })),
  };
}

export function createInventoryModel(
  source: InventorySnapshot | ProjectViewModelV1 | ProjectViewModelIndex,
  runtime?: RuntimeOverlayV1,
): InventoryModel {
  const snapshot = isProjectViewModel(source) || isProjectViewModelIndex(source)
    ? inventorySnapshotFromProjectModel(source, runtime)
    : source;
  const scopeById = new Map(snapshot.scopes.map((scope) => [scope.id, scope]));
  const scopeByPath = new Map(snapshot.scopes.map((scope) => [scope.path, scope]));
  const recordByPath = new Map<string, LocatedInventoryRecord>();
  const recordsById = new Map<string, LocatedInventoryRecord[]>();

  for (const scope of snapshot.scopes) {
    for (const record of scope.records) {
      const located = { record, scope };
      recordByPath.set(record.path, located);
      const matches = recordsById.get(record.id) ?? [];
      matches.push(located);
      recordsById.set(record.id, matches);
    }
  }

  return { snapshot, scopeById, scopeByPath, recordByPath, recordsById };
}

export function getInventoryScope(
  model: InventoryModel,
  scopeId: string,
): InventoryScope | undefined {
  return model.scopeById.get(scopeId);
}

export function inventoryRecordsOfKind<
  Kind extends keyof InventoryRecordByKind,
>(
  scope: InventoryScope,
  kind: Kind,
): InventoryRecordForKind<Kind>[] {
  return scope.records.filter(
    (record): record is InventoryRecordForKind<Kind> => record.kind === kind,
  );
}

export function inventoryRecordTitle(record: InventoryRecord): string {
  return record.label ?? record.id;
}

export function selectedOptionLabel(record: InventoryRecord): string {
  if (!record.selected) return 'Not selected';
  return record.options?.[record.selected] ?? record.selected;
}

/** Root inventory views include descendants; a sub-analysis stays local. */
export function inventoryScopesForView(
  model: InventoryModel,
  scope: InventoryScope,
): InventoryScope[] {
  return scope.parent ? [scope] : model.snapshot.scopes;
}

export function inventoryScopeForRecord(
  model: InventoryModel,
  record: InventoryRecord,
  fallback?: InventoryScope,
): InventoryScope | undefined {
  return model.recordByPath.get(record.path)?.scope ?? fallback;
}

function matchesKind(
  record: InventoryRecord,
  kind?: InventoryKind,
): boolean {
  return kind === undefined || record.kind === kind;
}

function parentScope(
  model: InventoryModel,
  scope: InventoryScope,
): InventoryScope | undefined {
  return scope.parent ? model.scopeById.get(scope.parent) : undefined;
}

const COLLECTION_KINDS: Readonly<Record<string, InventoryKind>> = {
  inputs: 'input',
  decisions: 'decision',
  outputs: 'output',
  findings: 'finding',
  prior_insights: 'prior_insight',
};

/** Resolve local ids, relative aliases, and fully-qualified ASTRA paths. */
export function resolveInventoryRecordReference(
  model: InventoryModel,
  scope: InventoryScope,
  reference: string,
  kind?: InventoryKind,
): LocatedInventoryRecord | undefined {
  let normalized = reference.trim();
  if (!normalized) return undefined;

  let owner = scope;
  while (normalized.startsWith('../')) {
    const parent = parentScope(model, owner);
    if (!parent) return undefined;
    owner = parent;
    normalized = normalized.slice(3);
  }
  if (normalized.startsWith('./')) normalized = normalized.slice(2);

  const parts = normalized.split('.');
  if (parts.length > 1) {
    const id = parts[parts.length - 1] ?? normalized;
    const scopePath = parts.slice(0, -1).join('.');
    const collectionKind = COLLECTION_KINDS[scopePath];
    if (collectionKind && (!kind || kind === collectionKind)) {
      let candidate: InventoryScope | undefined = owner;
      while (candidate) {
        const local = candidate.records.find(
          (record) => record.id === id && record.kind === collectionKind,
        );
        if (local) return { record: local, scope: candidate };
        candidate = parentScope(model, candidate);
      }
    }
  }

  const exact = model.recordByPath.get(normalized);
  if (exact && matchesKind(exact.record, kind)) return exact;

  if (parts.length > 1) {
    const id = parts[parts.length - 1] ?? normalized;
    const scopePath = parts.slice(0, -1).join('.');
    const qualifiedScope = model.scopeByPath.get(scopePath)
      ?? model.scopeById.get(scopePath);
    const qualified = qualifiedScope?.records.find(
      (record) => record.id === id && matchesKind(record, kind),
    );
    if (qualifiedScope && qualified) {
      return { record: qualified, scope: qualifiedScope };
    }
  }

  let candidate: InventoryScope | undefined = owner;
  while (candidate) {
    const local = candidate.records.find(
      (record) => record.id === normalized && matchesKind(record, kind),
    );
    if (local) return { record: local, scope: candidate };
    candidate = parentScope(model, candidate);
  }

  const matches = (model.recordsById.get(normalized) ?? [])
    .filter(({ record }) => matchesKind(record, kind));
  return matches.length === 1 ? matches[0] : undefined;
}

export function inventoryDecisionInsights(
  model: InventoryModel,
  scope: InventoryScope,
  decision: InventoryRecord,
): InventoryInsightRecord[] {
  return decisionEvidenceIds(decision)
    .map((id) => resolveInventoryRecordReference(
      model,
      scope,
      id,
      'prior_insight',
    )?.record)
    .filter((record): record is InventoryInsightRecord =>
      record?.kind === 'prior_insight',
    );
}

export function inventoryInformedDecisions(
  model: InventoryModel,
  scope: InventoryScope,
  insight: InventoryRecord,
): InventoryDecisionRecord[] {
  const decisions = new Map<string, InventoryDecisionRecord>();
  for (const candidate of inventoryScopesForView(model, scope)) {
    for (const decision of inventoryRecordsOfKind(candidate, 'decision')) {
      if (
        inventoryDecisionInsights(model, candidate, decision)
          .some((record) => record.path === insight.path)
        && !decisions.has(decision.path)
      ) {
        decisions.set(decision.path, decision);
      }
    }
  }
  return [...decisions.values()];
}
