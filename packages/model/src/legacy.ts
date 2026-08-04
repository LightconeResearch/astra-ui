import {
  PROJECT_VIEW_MODEL_SCHEMA_VERSION,
  type AstraRecordKind,
  type DecisionOptionView,
  type EvidenceDescriptor,
  type OutputType,
  type ProjectRecordView,
  type ProjectViewModelV1,
  type RecordRelation,
  type ResourceDescriptor,
} from './types.js';

export interface LegacyInventoryRecord {
  id: string;
  path: string;
  kind: AstraRecordKind;
  label?: string;
  description?: string;
  type?: string;
  tags?: string[];
  source?: string;
  ref?: string;
  from?: string;
  active?: boolean;
  when?: string | string[];
  selected?: string;
  options?: Record<string, string | undefined>;
  option_insights?: Record<string, string[]>;
  rationale?: string;
  claim?: string;
  notes?: string;
  scope?: string;
  doi?: string;
  quote?: string;
  page?: number;
  resolved_path?: string;
  resourceIds?: string[];
  mediaType?: string;
  byteSize?: number;
  resourceRevision?: string;
  recipe?: { command?: string; container?: string };
  inputs?: string[];
  decisions?: string[];
  evidence?: Array<{
    artifact?: string;
    doi?: string;
    quote?: string;
    page?: number;
  }>;
  metric?: {
    value?: number | string;
    uncertainty?: number | string;
    error?: number | string;
    unit?: string;
    units?: string;
    label?: string;
  };
  /** Analysis-level source inputs at the roots of the provenance chain. */
  inputs_root?: Array<{
    id: string;
    label?: string;
  }>;
  /** Every decision affecting an output, including inherited decisions. */
  decisions_transitive?: Array<{
    id: string;
    label?: string;
    selection?: string;
    via?: string;
  }>;
  table_data?: {
    headers: string[];
    rows: Array<Array<string | number | boolean | null>>;
  };
  table_preview?: {
    headers: string[];
    rows: Array<Array<string | number | boolean | null>>;
    total_rows: number;
    total_columns: number;
    serialized_bytes: number;
    truncated: boolean;
    cells_truncated?: boolean;
  };
  table_rows_total?: number;
  table_columns_total?: number;
  table_preview_omitted?: 'project_size_budget';
  /** Host-resolved, safe preview URL used only by the display bundle. */
  resultPreview?: string;
}

export interface LegacyInventoryScope {
  id: string;
  path: string;
  name: string;
  parent?: string;
  children: string[];
  records: LegacyInventoryRecord[];
}

export interface LegacyInventorySnapshot {
  version: number;
  fixture?: {
    label: string;
    source: string;
    frozen: string;
    disclaimer: string;
  };
  analysis: {
    id: string;
    name: string;
    description?: string;
  };
  scopes: LegacyInventoryScope[];
  diagnostics?: Array<{
    severity: 'error' | 'warning' | 'info';
    code?: string;
    message: string;
    path?: string;
  }>;
}

export interface LegacyAdapterOptions {
  analysisRevision?: string;
  selectionRevision?: string;
  universeId?: string;
  availableUniverses?: string[];
  astraVersion?: string;
  resources?: ResourceDescriptor[];
}

function outputType(type?: string): OutputType {
  if (type === 'data') return 'dataset';
  if (
    type === 'figure'
    || type === 'table'
    || type === 'metric'
    || type === 'dataset'
    || type === 'report'
    || type === 'file'
  ) return type;
  return 'other';
}

function resourceKind(type?: string): ResourceDescriptor['kind'] {
  const normalized = outputType(type);
  if (normalized === 'report') return 'document';
  if (normalized === 'file') return 'other';
  if (normalized === 'dataset') return 'dataset';
  if (normalized === 'figure' || normalized === 'table' || normalized === 'metric') {
    return normalized;
  }
  return 'other';
}

function relation(
  kind: RecordRelation['kind'],
  targetRecordId: string,
  direct = true,
): RecordRelation {
  return { kind, targetRecordId, direct };
}

function legacyEvidence(
  record: LegacyInventoryRecord,
): EvidenceDescriptor[] {
  if (record.evidence?.length) {
    return record.evidence.map((item) => ({
      ...(item.artifact ? { artifactRecordId: item.artifact } : {}),
      ...(item.doi ? { doi: item.doi } : {}),
      ...(item.quote ? { quote: item.quote } : {}),
      ...(item.page !== undefined ? { page: item.page } : {}),
    }));
  }
  if (!record.doi && !record.quote && record.page === undefined) return [];
  return [{
    ...(record.doi ? { doi: record.doi } : {}),
    ...(record.quote ? { quote: record.quote } : {}),
    ...(record.page !== undefined ? { page: record.page } : {}),
  }];
}

function baseRecord(
  record: LegacyInventoryRecord,
  scopeId: string,
  relations: RecordRelation[] = [],
): Omit<ProjectRecordView, 'kind'> & { kind: AstraRecordKind } {
  return {
    id: `${scopeId}:${record.kind}:${record.id}`,
    localId: record.id,
    canonicalPath: record.path,
    scopeId,
    kind: record.kind,
    ...(record.label ? { label: record.label } : {}),
    ...(record.description ? { description: record.description } : {}),
    ...(record.active !== undefined ? { active: record.active } : {}),
    ...(record.tags ? { tags: record.tags } : {}),
    relations,
  };
}

function adaptRecord(
  record: LegacyInventoryRecord,
  scopeId: string,
  resourceIds: string[] = [],
  relations: RecordRelation[] = [],
  insightRecordIds: ReadonlyMap<string, readonly string[]> = new Map(),
): ProjectRecordView {
  const base = baseRecord(record, scopeId, relations);
  if (record.kind === 'input') {
    return {
      ...base,
      kind: 'input',
      ...(record.type ? { inputType: record.type } : {}),
      ...(record.source ? { source: record.source } : {}),
      ...(record.ref ? { reference: record.ref } : {}),
    };
  }
  if (record.kind === 'decision') {
    const options: DecisionOptionView[] = Object.entries(record.options ?? {})
      .map(([id, label]) => ({
        id,
        ...(label ? { label } : {}),
        selected: id === record.selected,
        ...(insightRecordIds.get(id)?.length
          ? { insightRecordIds: [...insightRecordIds.get(id)!] }
          : {}),
      }));
    return {
      ...base,
      kind: 'decision',
      ...(record.rationale ? { rationale: record.rationale } : {}),
      ...(record.selected ? { selectedOptionId: record.selected } : {}),
      options,
    };
  }
  if (record.kind === 'output') {
    return {
      ...base,
      kind: 'output',
      outputType: outputType(record.type),
      ...(record.recipe ? { recipe: record.recipe } : {}),
      resourceIds,
      ...(record.metric ? {
        metric: {
          ...(record.metric.value !== undefined ? { value: record.metric.value } : {}),
          ...((record.metric.uncertainty ?? record.metric.error) !== undefined
            ? { uncertainty: record.metric.uncertainty ?? record.metric.error }
            : {}),
          ...((record.metric.unit ?? record.metric.units)
            ? { unit: record.metric.unit ?? record.metric.units }
            : {}),
          ...(record.metric.label ? { label: record.metric.label } : {}),
        },
      } : {}),
    };
  }
  if (record.kind === 'finding') {
    return {
      ...base,
      kind: 'finding',
      ...(record.claim ? { claim: record.claim } : {}),
      ...(record.notes ? { notes: record.notes } : {}),
      evidence: legacyEvidence(record),
    };
  }
  return {
    ...base,
    kind: 'prior_insight',
    ...(record.claim ? { claim: record.claim } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    evidence: legacyEvidence(record),
  };
}

function normalizedScopeId(scopeId: string): string {
  return scopeId || 'root';
}

function localRecordId(path: string): string {
  return path.split('.').at(-1) ?? path;
}

function parentScopePath(path: string): string {
  const segments = path.split('.').filter(Boolean);
  segments.pop();
  return segments.join('.');
}

/**
 * Transitional adapter for the MySTRA inventory prototype. New producers
 * should emit ProjectViewModelV1 directly.
 */
export function adaptLegacyInventorySnapshot(
  snapshot: LegacyInventorySnapshot,
  options: LegacyAdapterOptions = {},
): ProjectViewModelV1 {
  const resources: ResourceDescriptor[] = [...(options.resources ?? [])];
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const records: ProjectRecordView[] = [];
  const selectedDecisions: Record<string, string> = {};
  const adapterDiagnostics: ProjectViewModelV1['diagnostics'] = [];
  const scopeIdMap = new Map(
    snapshot.scopes.map((scope) => [scope.id, normalizedScopeId(scope.id)]),
  );
  const legacyByModelId = new Map<string, {
    scope: LegacyInventoryScope;
    record: LegacyInventoryRecord;
  }>();
  const modelIdByPath = new Map<string, string>();
  const candidatesByScopeAndLocalId = new Map<string, string[]>();

  for (const scope of snapshot.scopes) {
    const scopeId = normalizedScopeId(scope.id);
    for (const record of scope.records) {
      const modelId = `${scopeId}:${record.kind}:${record.id}`;
      legacyByModelId.set(modelId, { scope, record });
      modelIdByPath.set(record.path, modelId);
      const key = `${scopeId}\0${localRecordId(record.path)}`;
      const candidates = candidatesByScopeAndLocalId.get(key) ?? [];
      candidates.push(modelId);
      candidatesByScopeAndLocalId.set(key, candidates);
    }
  }

  function resolveReference(
    sourceScope: LegacyInventoryScope,
    rawReference: string,
    targetKinds: readonly AstraRecordKind[],
  ): string | undefined {
    const exact = modelIdByPath.get(rawReference);
    if (exact && targetKinds.includes(legacyByModelId.get(exact)!.record.kind)) {
      return exact;
    }

    let reference = rawReference;
    let targetScopePath = sourceScope.path;
    while (reference.startsWith('../')) {
      reference = reference.slice(3);
      targetScopePath = parentScopePath(targetScopePath);
    }

    const candidatePaths: string[] = [];
    let candidatePath = targetScopePath;
    while (true) {
      candidatePaths.push(candidatePath);
      if (!candidatePath) break;
      candidatePath = parentScopePath(candidatePath);
    }
    const scopeCandidates = candidatePaths.flatMap((path) =>
      snapshot.scopes.filter((scope) => path
        ? scope.path === path || scope.id === path
        : scope.path === '' || scope.id === ''),
    );

    const qualifiedSegments = reference.split('.').filter(Boolean);
    if (qualifiedSegments.length > 1) {
      const recordId = qualifiedSegments.at(-1)!;
      const scopePath = qualifiedSegments.slice(0, -1).join('.');
      const qualifiedScopes = snapshot.scopes.filter(
        (scope) => scope.path === scopePath || scope.id === scopePath,
      );
      if (qualifiedScopes.length) {
        scopeCandidates.splice(0, scopeCandidates.length, ...qualifiedScopes);
      }
      reference = recordId;
    }

    for (const scope of scopeCandidates) {
      const key = `${normalizedScopeId(scope.id)}\0${reference}`;
      const matches = (candidatesByScopeAndLocalId.get(key) ?? []).filter((modelId) =>
        targetKinds.includes(legacyByModelId.get(modelId)!.record.kind),
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return undefined;
    }
    return undefined;
  }

  function resolvedRelation(
    sourceScope: LegacyInventoryScope,
    sourceRecord: LegacyInventoryRecord,
    kind: RecordRelation['kind'],
    rawReference: string,
    targetKinds: readonly AstraRecordKind[],
    direct = true,
  ): RecordRelation | undefined {
    const targetRecordId = resolveReference(sourceScope, rawReference, targetKinds);
    if (targetRecordId) return relation(kind, targetRecordId, direct);
    adapterDiagnostics.push({
      severity: 'warning',
      code: 'legacy_unresolved_relation',
      message: `Could not uniquely resolve ${kind} reference "${rawReference}" from ${sourceRecord.path}.`,
      canonicalPath: sourceRecord.path,
    });
    return undefined;
  }

  for (const scope of snapshot.scopes) {
    const scopeId = normalizedScopeId(scope.id);
    for (const record of scope.records) {
      const recordId = `${scopeId}:${record.kind}:${record.id}`;
      const recordResourceIds = record.kind === 'output'
        ? record.resourceIds?.length
          ? [...record.resourceIds]
          : record.resolved_path
            ? [`resource:${recordId}`]
            : []
        : [];
      if (record.kind === 'output' && record.resolved_path && recordResourceIds[0]
        && !resourceIds.has(recordResourceIds[0])) {
        const resourceId = recordResourceIds[0];
        const fileName = record.resolved_path?.split('/').filter(Boolean).at(-1);
        resources.push({
          id: resourceId,
          kind: resourceKind(record.type),
          ...(fileName ? { fileName } : {}),
          ...(record.mediaType ? { mediaType: record.mediaType } : {}),
          ...(record.byteSize !== undefined ? { byteSize: record.byteSize } : {}),
          ...(record.resourceRevision ? { revision: record.resourceRevision } : {}),
          availability: 'available',
          source: 'inferred',
          outputRecordId: recordId,
        });
        resourceIds.add(resourceId);
      }
      const directRelations = [
        ...(record.inputs ?? []).map((reference) =>
          resolvedRelation(scope, record, 'depends_on', reference, ['input', 'output'])),
        ...(record.decisions ?? []).map((reference) =>
          resolvedRelation(scope, record, 'parameterized_by', reference, ['decision'])),
        ...(record.from ? [
          resolvedRelation(
            scope,
            record,
            'aliases',
            record.from,
            record.kind === 'input' ? ['input', 'output'] : [record.kind],
          ),
        ] : []),
        ...(record.evidence ?? [])
          .filter((item) => item.artifact)
          .map((item) => resolvedRelation(
            scope,
            record,
            'evidenced_by',
            item.artifact!,
            ['output'],
          )),
      ].filter((item): item is RecordRelation => Boolean(item));
      const transitiveDecisionRelations = record.kind === 'output'
        ? (record.decisions_transitive ?? []).map((dependency) => {
          const owner = dependency.via === 'root'
            ? snapshot.scopes.find((candidate) =>
              normalizedScopeId(candidate.id) === 'root'
              && (!candidate.path || candidate.path === 'root'))
            : dependency.via
              ? snapshot.scopes.find((candidate) =>
                candidate.id === dependency.via || candidate.path === dependency.via)
              : scope;
          if (!owner) {
            adapterDiagnostics.push({
              severity: 'warning',
              code: 'legacy_unresolved_relation_scope',
              message: `Could not resolve decision scope "${dependency.via}" from ${record.path}.`,
              canonicalPath: record.path,
            });
            return undefined;
          }
          return resolvedRelation(
            owner,
            record,
            'parameterized_by',
            dependency.id,
            ['decision'],
            false,
          );
        }).filter((item): item is RecordRelation => Boolean(item))
        : [];
      const relationByTarget = new Map<string, RecordRelation>();
      for (const item of [...directRelations, ...transitiveDecisionRelations]) {
        const key = `${item.kind}\0${item.targetRecordId}`;
        const previous = relationByTarget.get(key);
        if (!previous || (previous.direct === false && item.direct !== false)) {
          relationByTarget.set(key, item);
        }
      }
      const relations = [...relationByTarget.values()];
      const insightRecordIds = new Map<string, readonly string[]>();
      for (const [optionId, insightReferences] of Object.entries(record.option_insights ?? {})) {
        const resolved = insightReferences
          .map((reference) => resolveReference(scope, reference, ['prior_insight']))
          .filter((item): item is string => Boolean(item));
        if (resolved.length) insightRecordIds.set(optionId, resolved);
        for (const reference of insightReferences) {
          if (!resolveReference(scope, reference, ['prior_insight'])) {
            adapterDiagnostics.push({
              severity: 'warning',
              code: 'legacy_unresolved_option_insight',
              message: `Could not uniquely resolve option insight "${reference}" from ${record.path}.`,
              canonicalPath: record.path,
            });
          }
        }
      }
      const adapted = adaptRecord(
        record,
        scopeId,
        recordResourceIds,
        relations,
        insightRecordIds,
      );
      records.push(adapted);
      if (record.kind === 'decision' && record.selected) {
        selectedDecisions[adapted.id] = record.selected;
      }
    }
  }

  return {
    schemaVersion: PROJECT_VIEW_MODEL_SCHEMA_VERSION,
    revision: {
      analysis: options.analysisRevision ?? `legacy:${snapshot.version}`,
      ...(options.selectionRevision
        ? { selection: options.selectionRevision }
        : {}),
    },
    project: {
      id: snapshot.analysis.id,
      name: snapshot.analysis.name,
      ...(snapshot.analysis.description
        ? { description: snapshot.analysis.description }
        : {}),
      ...(options.astraVersion ? { astraVersion: options.astraVersion } : {}),
    },
    selection: {
      ...(options.universeId ? { universeId: options.universeId } : {}),
      availableUniverses: options.availableUniverses ?? [],
      decisions: selectedDecisions,
      source: options.universeId ? 'explicit' : 'unknown',
    },
    scopes: snapshot.scopes.map((scope) => ({
      id: normalizedScopeId(scope.id),
      canonicalPath: scope.path || 'root',
      name: scope.name,
      ...(scope.parent !== undefined
        ? { parentId: scopeIdMap.get(scope.parent) ?? normalizedScopeId(scope.parent) }
        : {}),
      childIds: scope.children.map(
        (childId) => scopeIdMap.get(childId) ?? normalizedScopeId(childId),
      ),
      recordIds: scope.records.map(
        (record) => `${normalizedScopeId(scope.id)}:${record.kind}:${record.id}`,
      ),
    })),
    records,
    resources,
    diagnostics: [
      ...(snapshot.diagnostics ?? []).map((diagnostic) => ({
      severity: diagnostic.severity,
      code: diagnostic.code ?? 'legacy_inventory_diagnostic',
      message: diagnostic.message,
      ...(diagnostic.path ? { canonicalPath: diagnostic.path } : {}),
      })),
      ...adapterDiagnostics,
    ],
  };
}

/** Compatibility spelling used by the first standalone Jupyter adapter. */
export const adaptLegacyProjectModel = adaptLegacyInventorySnapshot;
