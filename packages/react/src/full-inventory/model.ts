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

export function createInventoryModel(snapshot: InventorySnapshot): InventoryModel {
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
