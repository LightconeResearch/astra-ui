import {
  createProjectViewModelIndex,
  type AstraRecordKind,
  type ProjectRecordView,
  type ProjectScopeView,
  type ProjectViewModelIndex,
  type ProjectViewModelV1,
} from '@astra-spec/sdk/view-model';
import type { RuntimeOverlayV1 } from '../viewer-types.js';
import type {
  InventoryDecisionRecord,
  InventoryInsightRecord,
  InventoryKind,
  InventoryRecord,
  InventoryScope,
} from '../types.js';

export type InventoryModel = ProjectViewModelIndex;

export interface LocatedInventoryRecord {
  record: InventoryRecord;
  scope: InventoryScope;
}

export type InventoryRecordForKind<Kind extends AstraRecordKind> = Extract<
  ProjectRecordView,
  { kind: Kind }
>;

function isProjectViewModelIndex(
  source: ProjectViewModelV1 | ProjectViewModelIndex,
): source is ProjectViewModelIndex {
  return 'model' in source && 'recordById' in source;
}

export function createInventoryModel(
  source: ProjectViewModelV1 | ProjectViewModelIndex,
  runtime?: RuntimeOverlayV1,
): InventoryModel {
  return isProjectViewModelIndex(source)
    ? source
    : createProjectViewModelIndex(source, runtime?.resources ?? []);
}

/** Return cited insight ids with the selected option first, then alternatives. */
export function decisionEvidenceIds(decision: InventoryDecisionRecord): string[] {
  const selected = decision.options.find(
    (option) => option.id === decision.selectedOptionId,
  );
  const ordered = [
    ...(selected?.insightRecordIds ?? []),
    ...decision.options
      .filter((option) => option.id !== decision.selectedOptionId)
      .flatMap((option) => option.insightRecordIds ?? []),
  ];
  return [...new Set(ordered)];
}

export function getInventoryScope(
  model: InventoryModel,
  scopeId: string,
): InventoryScope | undefined {
  return model.scopeById.get(scopeId);
}

export function inventoryRecordsOfKind<Kind extends AstraRecordKind>(
  scope: InventoryScope,
  kind: Kind,
  model?: InventoryModel,
): InventoryRecordForKind<Kind>[] {
  if (!model) return [];
  return scope.recordIds
    .map((id) => model.recordById.get(id))
    .filter(
      (record): record is InventoryRecordForKind<Kind> => record?.kind === kind,
    );
}

export function inventoryRecordTitle(record: InventoryRecord): string {
  return record.label ?? record.localId;
}

export function selectedOptionLabel(record: InventoryDecisionRecord): string {
  if (!record.selectedOptionId) return 'Not selected';
  return record.options.find((option) => option.id === record.selectedOptionId)?.label
    ?? record.selectedOptionId;
}

/** Root inventory views include descendants; a sub-analysis stays local. */
export function inventoryScopesForView(
  model: InventoryModel,
  scope: InventoryScope,
): InventoryScope[] {
  return scope.parentId ? [scope] : model.model.scopes;
}

export function inventoryScopeForRecord(
  model: InventoryModel,
  record: InventoryRecord,
  fallback?: InventoryScope,
): InventoryScope | undefined {
  return model.recordById.get(record.id)
    ? model.scopeById.get(record.scopeId) ?? fallback
    : fallback;
}

function matchesKind(
  record: InventoryRecord,
  kind?: InventoryKind,
): boolean {
  return kind === undefined || kind === 'analysis' || record.kind === kind;
}

function parentScope(
  model: InventoryModel,
  scope: InventoryScope,
): InventoryScope | undefined {
  return scope.parentId ? model.scopeById.get(scope.parentId) : undefined;
}

const COLLECTION_KINDS: Readonly<Record<string, AstraRecordKind>> = {
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

  const modelId = model.recordById.get(normalized);
  if (modelId && matchesKind(modelId, kind)) {
    const owner = model.scopeById.get(modelId.scopeId);
    return owner ? { record: modelId, scope: owner } : undefined;
  }

  let owner = scope;
  while (normalized.startsWith('../')) {
    const parent = parentScope(model, owner);
    if (!parent) return undefined;
    owner = parent;
    normalized = normalized.slice(3);
  }
  if (normalized.startsWith('./')) normalized = normalized.slice(2);

  const exact = model.recordByPath.get(normalized);
  if (exact && matchesKind(exact.record, kind)) return exact;

  const parts = normalized.split('.').filter(Boolean);
  if (parts.length > 1) {
    const id = parts[parts.length - 1] ?? normalized;
    const scopePath = parts.slice(0, -1).join('.');
    const collectionKind = COLLECTION_KINDS[scopePath];
    if (collectionKind && (!kind || kind === collectionKind)) {
      let candidate: InventoryScope | undefined = owner;
      while (candidate) {
        const local = candidate.recordIds
          .map((recordId) => model.recordById.get(recordId))
          .find((record) => record?.localId === id && record.kind === collectionKind);
        if (local) return { record: local, scope: candidate };
        candidate = parentScope(model, candidate);
      }
    }
    const qualifiedScope = model.scopeByPath.get(scopePath)
      ?? model.scopeById.get(scopePath);
    const qualified = qualifiedScope?.recordIds
      .map((recordId) => model.recordById.get(recordId))
      .find((record) => record?.localId === id && matchesKind(record, kind));
    if (qualifiedScope && qualified) return { record: qualified, scope: qualifiedScope };
  }

  let candidate: ProjectScopeView | undefined = owner;
  while (candidate) {
    const local = candidate.recordIds
      .map((recordId) => model.recordById.get(recordId))
      .find((record) => record?.localId === normalized && matchesKind(record, kind));
    if (local) return { record: local, scope: candidate };
    candidate = parentScope(model, candidate);
  }

  const matches = (model.recordsByLocalId.get(normalized) ?? [])
    .filter(({ record }) => matchesKind(record, kind));
  return matches.length === 1 ? matches[0] : undefined;
}

export function inventoryDecisionInsights(
  model: InventoryModel,
  _scope: InventoryScope,
  decision: InventoryDecisionRecord,
): InventoryInsightRecord[] {
  return decisionEvidenceIds(decision)
    .map((id) => model.recordById.get(id))
    .filter(
      (record): record is InventoryInsightRecord => record?.kind === 'prior_insight',
    );
}

export function inventoryInformedDecisions(
  model: InventoryModel,
  scope: InventoryScope,
  insight: InventoryInsightRecord,
): InventoryDecisionRecord[] {
  const decisions = new Map<string, InventoryDecisionRecord>();
  for (const candidate of inventoryScopesForView(model, scope)) {
    for (const decision of inventoryRecordsOfKind(candidate, 'decision', model)) {
      if (
        decisionEvidenceIds(decision).includes(insight.id)
        && !decisions.has(decision.id)
      ) {
        decisions.set(decision.id, decision);
      }
    }
  }
  return [...decisions.values()];
}
