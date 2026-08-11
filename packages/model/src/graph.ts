import { createProjectViewModelIndex } from './indexing.js';
import type {
  AstraRecordKind,
  ProjectRecordView,
  ProjectScopeView,
  ProjectViewModelV1,
  RecordRelationKind,
  ViewerDiagnostic,
} from './types.js';

export const GRAPH_ORGANIZATION_SCHEMA_VERSION =
  'graph-organization.v1' as const;

export type GraphOrganizationSchemaVersion =
  typeof GRAPH_ORGANIZATION_SCHEMA_VERSION;

export interface GraphOrganizationSource {
  entrypoint: string;
  organizationInputDigest: string;
}

export interface GraphOrganizationGroup {
  id: string;
  label: string;
  scope: string;
  kind: AstraRecordKind;
  members: string[];
}

/** Optional presentation metadata. It never adds or removes ASTRA relations. */
export interface GraphOrganizationV1 {
  schemaVersion: GraphOrganizationSchemaVersion;
  source: GraphOrganizationSource;
  groups: GraphOrganizationGroup[];
}

export type GraphOrganizationStatus =
  | 'missing'
  | 'current'
  | 'stale_valid'
  | 'stale_partly_invalid';

export interface ValidatedGraphGroup extends GraphOrganizationGroup {
  scopeId: string;
  memberRecordIds: string[];
}

export interface ProjectGraphRecordNode {
  id: string;
  nodeType: 'record';
  scopeId: string;
  kind: AstraRecordKind;
  label: string;
  description?: string;
  recordId: string;
  canonicalPath: string;
}

export interface ProjectGraphGroupNode {
  id: string;
  nodeType: 'group';
  scopeId: string;
  kind: AstraRecordKind;
  label: string;
  groupId: string;
  memberRecordIds: string[];
}

export interface ProjectGraphScopeNode {
  id: string;
  nodeType: 'scope';
  scopeId: string;
  kind: 'analysis';
  label: string;
  description?: string;
  targetScopeId: string;
  canonicalPath: string;
  recordCount: number;
}

export type ProjectGraphNode =
  | ProjectGraphRecordNode
  | ProjectGraphGroupNode
  | ProjectGraphScopeNode;

export interface ProjectGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationKinds: RecordRelationKind[];
  underlyingRelationIds: string[];
  projectionRole?: 'subanalysis_input';
}

export interface ProjectGraphScope {
  id: string;
  canonicalPath: string;
  name: string;
  parentId?: string;
  depth: number;
  nodeIds: string[];
}

export interface ProjectGraphV1 {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  scopes: ProjectGraphScope[];
  focusScopeId: string;
  organization?: GraphOrganizationV1;
  organizationStatus: GraphOrganizationStatus;
  diagnostics: ViewerDiagnostic[];
  validGroups: ValidatedGraphGroup[];
}

export interface BuildProjectGraphOptions {
  useOrganization?: boolean;
  expandedGroupIds?: ReadonlySet<string>;
  focusScopeId?: string;
}

interface ParsedOrganization {
  organization?: GraphOrganizationV1;
  diagnostics: ViewerDiagnostic[];
}

interface GroupCandidate {
  group: GraphOrganizationGroup;
  scope?: ProjectScopeView;
  records: ProjectRecordView[];
  diagnostics: ViewerDiagnostic[];
}

const RECORD_KINDS = new Set<AstraRecordKind>([
  'input',
  'decision',
  'output',
  'finding',
  'prior_insight',
]);

const FLOW_RELATIONS = new Set<RecordRelationKind>([
  'depends_on',
  'parameterized_by',
  'informed_by',
  'evidenced_by',
  'aliases',
  'derived_from',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  camel: string,
  snake = camel,
): string | undefined {
  const candidate = value[camel] ?? value[snake];
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function organizationDiagnostic(
  severity: ViewerDiagnostic['severity'],
  code: string,
  message: string,
): ViewerDiagnostic {
  return { severity, code, message };
}

/**
 * Parse the JSON-compatible value produced from `astra.graph.yaml`.
 * Both YAML snake_case and the in-memory camelCase spellings are accepted.
 */
export function parseGraphOrganization(value: unknown): ParsedOrganization {
  const diagnostics: ViewerDiagnostic[] = [];
  if (value === undefined || value === null) return { diagnostics };
  if (!isObject(value)) {
    return {
      diagnostics: [organizationDiagnostic(
        'error',
        'graph_organization_not_mapping',
        'Graph organization must be a YAML mapping.',
      )],
    };
  }

  const schemaVersion = stringField(value, 'schemaVersion', 'schema_version');
  if (schemaVersion !== GRAPH_ORGANIZATION_SCHEMA_VERSION) {
    diagnostics.push(organizationDiagnostic(
      'error',
      'graph_organization_schema_version',
      `Graph organization schema_version must be "${GRAPH_ORGANIZATION_SCHEMA_VERSION}".`,
    ));
  }

  const rawSource = value.source;
  let source: GraphOrganizationSource | undefined;
  if (!isObject(rawSource)) {
    diagnostics.push(organizationDiagnostic(
      'error',
      'graph_organization_source',
      'Graph organization requires a source mapping.',
    ));
  } else {
    const entrypoint = stringField(rawSource, 'entrypoint');
    const organizationInputDigest = stringField(
      rawSource,
      'organizationInputDigest',
      'organization_input_digest',
    );
    if (!entrypoint) {
      diagnostics.push(organizationDiagnostic(
        'error',
        'graph_organization_entrypoint',
        'Graph organization source.entrypoint must be a non-empty string.',
      ));
    }
    if (!organizationInputDigest) {
      diagnostics.push(organizationDiagnostic(
        'error',
        'graph_organization_digest',
        'Graph organization source.organization_input_digest must be a non-empty string.',
      ));
    }
    if (entrypoint && organizationInputDigest) {
      source = { entrypoint, organizationInputDigest };
    }
  }

  const rawGroups = value.groups;
  const groups: GraphOrganizationGroup[] = [];
  if (!Array.isArray(rawGroups)) {
    diagnostics.push(organizationDiagnostic(
      'error',
      'graph_organization_groups',
      'Graph organization groups must be a list.',
    ));
  } else {
    rawGroups.forEach((rawGroup, index) => {
      if (!isObject(rawGroup)) {
        diagnostics.push(organizationDiagnostic(
          'error',
          'graph_group_not_mapping',
          `Graph group ${index + 1} must be a mapping.`,
        ));
        return;
      }
      const id = stringField(rawGroup, 'id');
      const label = stringField(rawGroup, 'label');
      const scope = stringField(rawGroup, 'scope');
      const kindValue = stringField(rawGroup, 'kind');
      const members = Array.isArray(rawGroup.members)
        ? rawGroup.members.filter(
          (member): member is string => typeof member === 'string' && Boolean(member.trim()),
        ).map((member) => member.trim())
        : [];
      if (!id || !label || !scope || !kindValue || !RECORD_KINDS.has(kindValue as AstraRecordKind)) {
        diagnostics.push(organizationDiagnostic(
          'error',
          'graph_group_shape',
          `Graph group ${index + 1} requires id, label, scope, and a supported kind.`,
        ));
        return;
      }
      if (!Array.isArray(rawGroup.members)) {
        diagnostics.push(organizationDiagnostic(
          'error',
          'graph_group_members',
          `Graph group "${id}" members must be a list.`,
        ));
        return;
      }
      groups.push({
        id,
        label,
        scope,
        kind: kindValue as AstraRecordKind,
        members,
      });
    });
  }

  if (!source || schemaVersion !== GRAPH_ORGANIZATION_SCHEMA_VERSION) {
    return { diagnostics };
  }
  return {
    organization: {
      schemaVersion: GRAPH_ORGANIZATION_SCHEMA_VERSION,
      source,
      groups,
    },
    diagnostics,
  };
}

function scopeDepth(scope: ProjectScopeView, scopeById: ReadonlyMap<string, ProjectScopeView>): number {
  let depth = 0;
  let current = scope;
  const visited = new Set<string>();
  while (current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = scopeById.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

function resolveGroupScope(
  group: GraphOrganizationGroup,
  scopes: readonly ProjectScopeView[],
): ProjectScopeView | undefined {
  return scopes.find(
    (scope) => scope.id === group.scope || scope.canonicalPath === group.scope,
  );
}

function resolveGroupMember(
  member: string,
  scope: ProjectScopeView,
  kind: AstraRecordKind,
  records: readonly ProjectRecordView[],
): ProjectRecordView | undefined {
  const matches = records.filter((record) =>
    record.scopeId === scope.id
    && record.kind === kind
    && (
      record.id === member
      || record.localId === member
      || record.canonicalPath === member
    )
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function dependencyAdjacency(model: ProjectViewModelV1): ReadonlyMap<string, readonly string[]> {
  const adjacency = new Map<string, string[]>();
  const recordIds = new Set(model.records.map((record) => record.id));
  for (const record of model.records) {
    for (const relation of record.relations) {
      if (!FLOW_RELATIONS.has(relation.kind) || !recordIds.has(relation.targetRecordId)) continue;
      const targets = adjacency.get(relation.targetRecordId) ?? [];
      targets.push(record.id);
      adjacency.set(relation.targetRecordId, targets);
    }
  }
  return adjacency;
}

function hasPath(
  adjacency: ReadonlyMap<string, readonly string[]>,
  source: string,
  target: string,
): boolean {
  const pending = [...(adjacency.get(source) ?? [])];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

function validateGroups(
  model: ProjectViewModelV1,
  organization: GraphOrganizationV1,
): { validGroups: ValidatedGraphGroup[]; diagnostics: ViewerDiagnostic[] } {
  const diagnostics: ViewerDiagnostic[] = [];
  const candidates: GroupCandidate[] = [];
  const duplicateGroupIds = new Set<string>();
  const seenGroupIds = new Set<string>();
  const adjacency = dependencyAdjacency(model);

  for (const group of organization.groups) {
    const groupDiagnostics: ViewerDiagnostic[] = [];
    if (!/^[a-z][a-z0-9_-]*$/.test(group.id)) {
      groupDiagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_id',
        `Group "${group.id}" must use a lowercase ASTRA-style id.`,
      ));
    }
    if (seenGroupIds.has(group.id)) duplicateGroupIds.add(group.id);
    seenGroupIds.add(group.id);

    const scope = resolveGroupScope(group, model.scopes);
    if (!scope) {
      groupDiagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_scope',
        `Group "${group.id}" refers to unknown ASTRA scope "${group.scope}".`,
      ));
    }

    const records = scope
      ? group.members.flatMap((member) => {
        const record = resolveGroupMember(member, scope, group.kind, model.records);
        if (!record) {
          groupDiagnostics.push(organizationDiagnostic(
            'warning',
            'graph_group_member',
            `Group "${group.id}" cannot resolve ${group.kind} "${member}" in scope "${group.scope}".`,
          ));
          return [];
        }
        return [record];
      })
      : [];

    if (group.members.length < 2) {
      groupDiagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_too_small',
        `Group "${group.id}" must contain at least two records.`,
      ));
    }
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      groupDiagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_duplicate_member',
        `Group "${group.id}" lists the same record more than once.`,
      ));
    }
    for (let left = 0; left < records.length; left += 1) {
      for (let right = left + 1; right < records.length; right += 1) {
        const leftRecord = records[left];
        const rightRecord = records[right];
        if (
          leftRecord
          && rightRecord
          && (
            hasPath(adjacency, leftRecord.id, rightRecord.id)
            || hasPath(adjacency, rightRecord.id, leftRecord.id)
          )
        ) {
          groupDiagnostics.push(organizationDiagnostic(
            'warning',
            'graph_group_dependency',
            `Group "${group.id}" contains records that depend on one another.`,
          ));
          left = records.length;
          break;
        }
      }
    }
    candidates.push({ group, ...(scope ? { scope } : {}), records, diagnostics: groupDiagnostics });
  }

  for (const duplicateId of duplicateGroupIds) {
    for (const candidate of candidates.filter(({ group }) => group.id === duplicateId)) {
      candidate.diagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_duplicate_id',
        `Graph group id "${duplicateId}" is duplicated.`,
      ));
    }
  }

  const groupsByRecordId = new Map<string, GroupCandidate[]>();
  for (const candidate of candidates) {
    for (const record of candidate.records) {
      const owners = groupsByRecordId.get(record.id) ?? [];
      owners.push(candidate);
      groupsByRecordId.set(record.id, owners);
    }
  }
  for (const [recordId, owners] of groupsByRecordId) {
    if (owners.length < 2) continue;
    const record = model.records.find((candidate) => candidate.id === recordId);
    for (const owner of owners) {
      owner.diagnostics.push(organizationDiagnostic(
        'warning',
        'graph_group_overlap',
        `Record "${record?.canonicalPath ?? recordId}" appears in more than one graph group.`,
      ));
    }
  }

  const validGroups = candidates.flatMap(({ group, scope, records, diagnostics: groupDiagnostics }) => {
    diagnostics.push(...groupDiagnostics);
    if (!scope || groupDiagnostics.length) return [];
    return [{
      ...group,
      scopeId: scope.id,
      memberRecordIds: records.map((record) => record.id),
    }];
  });
  return { validGroups, diagnostics };
}

function recordLabel(record: ProjectRecordView): string {
  return record.label?.trim()
    || record.localId.replaceAll('_', ' ')
    || record.canonicalPath;
}

function projectRootScope(model: ProjectViewModelV1): ProjectScopeView {
  return model.scopes.find((scope) => !scope.parentId)
    ?? model.scopes[0]
    ?? {
      id: 'root',
      canonicalPath: 'root',
      name: model.project.name,
      childIds: [],
      recordIds: [],
    };
}

function childScopeWithinFocus(
  scopeId: string,
  focusScopeId: string,
  scopeById: ReadonlyMap<string, ProjectScopeView>,
): ProjectScopeView | undefined {
  let current = scopeById.get(scopeId);
  const visited = new Set<string>();
  while (current && current.id !== focusScopeId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === focusScopeId) return current;
    current = current.parentId ? scopeById.get(current.parentId) : undefined;
  }
  return undefined;
}

function isScopeWithinFocus(
  scope: ProjectScopeView,
  focusScopeId: string,
  scopeById: ReadonlyMap<string, ProjectScopeView>,
): boolean {
  if (scope.id === focusScopeId) return true;
  return Boolean(childScopeWithinFocus(scope.id, focusScopeId, scopeById));
}

function graphEdges(
  model: ProjectViewModelV1,
  nodeIdByRecordId: ReadonlyMap<string, string>,
): ProjectGraphEdge[] {
  const recordIds = new Set(model.records.map((record) => record.id));
  const byEndpoints = new Map<string, {
    kinds: Set<RecordRelationKind>;
    underlying: string[];
  }>();
  for (const record of model.records) {
    for (const relation of record.relations) {
      if (!FLOW_RELATIONS.has(relation.kind) || !recordIds.has(relation.targetRecordId)) continue;
      // The graph is a direct structural projection. Transitive provenance is
      // retained for record details, but drawing it here makes upstream roots
      // appear to be immediate inputs of every downstream product.
      if (relation.direct === false) continue;
      const sourceNodeId = nodeIdByRecordId.get(relation.targetRecordId);
      const targetNodeId = nodeIdByRecordId.get(record.id);
      if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) continue;
      const key = `${sourceNodeId}\0${targetNodeId}`;
      const aggregate = byEndpoints.get(key) ?? {
        kinds: new Set<RecordRelationKind>(),
        underlying: [],
      };
      aggregate.kinds.add(relation.kind);
      aggregate.underlying.push(
        `${relation.targetRecordId}:${relation.kind}:${record.id}`,
      );
      byEndpoints.set(key, aggregate);
    }
  }
  return [...byEndpoints.entries()].map(([key, aggregate]) => {
    const [sourceNodeId, targetNodeId] = key.split('\0') as [string, string];
    return {
      id: `edge:${sourceNodeId}:${targetNodeId}`,
      sourceNodeId,
      targetNodeId,
      relationKinds: [...aggregate.kinds].sort(),
      underlyingRelationIds: aggregate.underlying,
    };
  });
}

/** Build a complete graph, safely contracting only valid organization groups. */
export function buildProjectGraph(
  model: ProjectViewModelV1,
  rawOrganization?: unknown,
  options: BuildProjectGraphOptions = {},
): ProjectGraphV1 {
  const parsed = parseGraphOrganization(rawOrganization);
  const diagnostics = [...parsed.diagnostics];
  const validation = parsed.organization
    ? validateGroups(model, parsed.organization)
    : { validGroups: [], diagnostics: [] };
  diagnostics.push(...validation.diagnostics);

  const index = createProjectViewModelIndex(model);
  const requestedFocus = options.focusScopeId
    ? index.scopeById.get(options.focusScopeId)
    : undefined;
  const focusScope = requestedFocus ?? projectRootScope(model);

  // A child analysis remains one expandable scope node, but outputs that cross
  // its boundary are useful in the parent graph. Derive those outputs only
  // from canonical relations: an output is a boundary output when a record
  // outside its immediate child scope consumes it.
  const boundaryOutputIds = new Set<string>();
  for (const consumer of model.records) {
    for (const relation of consumer.relations) {
      if (!FLOW_RELATIONS.has(relation.kind)) continue;
      const target = index.recordById.get(relation.targetRecordId);
      if (!target || target.kind !== 'output') continue;
      const child = childScopeWithinFocus(target.scopeId, focusScope.id, index.scopeById);
      if (!child || child.id !== target.scopeId) continue;
      const consumerScope = index.scopeById.get(consumer.scopeId);
      if (consumerScope && isScopeWithinFocus(consumerScope, child.id, index.scopeById)) continue;
      boundaryOutputIds.add(target.id);
    }
  }
  const boundaryOutputs = model.records.filter((record) => boundaryOutputIds.has(record.id));

  const useOrganization = options.useOrganization ?? true;
  const expanded = options.expandedGroupIds ?? new Set<string>();
  const focusGroups = useOrganization
    ? validation.validGroups.filter((group) => (
      group.scopeId === focusScope.id
      && group.kind !== 'decision'
      && !expanded.has(group.id)
    ))
    : [];
  const boundaryGroups = useOrganization
    ? validation.validGroups.filter((group) => (
      group.kind === 'output'
      && focusScope.childIds.includes(group.scopeId)
      && !expanded.has(group.id)
      && group.memberRecordIds.length > 0
      && group.memberRecordIds.every((recordId) => boundaryOutputIds.has(recordId))
    ))
    : [];
  const appliedGroups = [...focusGroups, ...boundaryGroups];
  const groupByRecordId = new Map<string, ValidatedGraphGroup>();
  for (const group of appliedGroups) {
    for (const recordId of group.memberRecordIds) groupByRecordId.set(recordId, group);
  }

  const nodes: ProjectGraphNode[] = [];
  const nodeIdByRecordId = new Map<string, string>();
  for (const group of appliedGroups) {
    const nodeId = `group:${group.id}`;
    nodes.push({
      id: nodeId,
      nodeType: 'group',
      scopeId: group.scopeId,
      kind: group.kind,
      label: group.label,
      groupId: group.id,
      memberRecordIds: group.memberRecordIds,
    });
    for (const recordId of group.memberRecordIds) nodeIdByRecordId.set(recordId, nodeId);
  }
  for (const record of model.records.filter((candidate) => candidate.scopeId === focusScope.id)) {
    if (groupByRecordId.has(record.id)) continue;
    const nodeId = `record:${record.id}`;
    nodeIdByRecordId.set(record.id, nodeId);
    nodes.push({
      id: nodeId,
      nodeType: 'record',
      scopeId: record.scopeId,
      kind: record.kind,
      label: recordLabel(record),
      ...(record.description ? { description: record.description } : {}),
      recordId: record.id,
      canonicalPath: record.canonicalPath,
    });
  }

  for (const childId of focusScope.childIds) {
    const child = index.scopeById.get(childId);
    if (!child) continue;
    nodes.push({
      id: `scope:${child.id}`,
      nodeType: 'scope',
      scopeId: child.id,
      kind: 'analysis',
      label: child.name,
      ...(child.description ? { description: child.description } : {}),
      targetScopeId: child.id,
      canonicalPath: child.canonicalPath,
      recordCount: child.recordIds.length,
    });
  }

  for (const record of boundaryOutputs) {
    if (groupByRecordId.has(record.id)) continue;
    const nodeId = `record:${record.id}`;
    nodeIdByRecordId.set(record.id, nodeId);
    nodes.push({
      id: nodeId,
      nodeType: 'record',
      scopeId: record.scopeId,
      kind: record.kind,
      label: recordLabel(record),
      ...(record.description ? { description: record.description } : {}),
      recordId: record.id,
      canonicalPath: record.canonicalPath,
    });
  }

  for (const record of model.records) {
    if (record.scopeId === focusScope.id) continue;
    const child = childScopeWithinFocus(record.scopeId, focusScope.id, index.scopeById);
    if (child && !nodeIdByRecordId.has(record.id)) {
      nodeIdByRecordId.set(record.id, `scope:${child.id}`);
    }
  }

  const focusDepth = scopeDepth(focusScope, index.scopeById);
  const scopes: ProjectGraphScope[] = model.scopes
    .filter((scope) => isScopeWithinFocus(scope, focusScope.id, index.scopeById))
    .map((scope) => ({
    id: scope.id,
    canonicalPath: scope.canonicalPath,
    name: scope.name,
    ...(scope.id !== focusScope.id && scope.parentId ? { parentId: scope.parentId } : {}),
    depth: Math.max(0, scopeDepth(scope, index.scopeById) - focusDepth),
    nodeIds: nodes.filter((node) => node.scopeId === scope.id).map((node) => node.id),
  }));

  const digestIsCurrent = parsed.organization?.source.organizationInputDigest
    === model.revision.analysis;
  const hasInvalidOrganization = diagnostics.length > 0;
  let organizationStatus: GraphOrganizationStatus = 'missing';
  if (rawOrganization !== undefined && rawOrganization !== null) {
    organizationStatus = hasInvalidOrganization
      ? 'stale_partly_invalid'
      : digestIsCurrent
        ? 'current'
        : 'stale_valid';
  }

  const boundaryScopeByNodeId = new Map<string, string>();
  for (const output of boundaryOutputs) {
    const nodeId = nodeIdByRecordId.get(output.id);
    if (nodeId) boundaryScopeByNodeId.set(nodeId, output.scopeId);
  }
  const edges = graphEdges(model, nodeIdByRecordId).filter((edge) => {
    const boundaryScopeId = boundaryScopeByNodeId.get(edge.sourceNodeId);
    // Consumers that remain inside the child are represented inside the scope,
    // not as a reverse boundary-output → scope edge in the parent projection.
    return !boundaryScopeId || edge.targetNodeId !== `scope:${boundaryScopeId}`;
  });

  // A child input's `from` relation is canonically an alias, but once the
  // child is collapsed to a single scope node its role in the parent graph is
  // an incoming data/artifact flow. Mark that projection role without
  // rewriting the underlying ASTRA relation or manufacturing a dependency.
  const subanalysisInputEndpoints = new Set<string>();
  for (const input of model.records) {
    if (input.kind !== 'input' || input.scopeId === focusScope.id) continue;
    const child = childScopeWithinFocus(input.scopeId, focusScope.id, index.scopeById);
    if (!child) continue;
    for (const relation of input.relations) {
      if (relation.kind !== 'aliases') continue;
      const source = index.recordById.get(relation.targetRecordId);
      if (!source) continue;
      const sourceScope = index.scopeById.get(source.scopeId);
      if (sourceScope && isScopeWithinFocus(sourceScope, child.id, index.scopeById)) continue;
      const sourceNodeId = nodeIdByRecordId.get(source.id);
      const targetNodeId = `scope:${child.id}`;
      if (sourceNodeId && sourceNodeId !== targetNodeId) {
        subanalysisInputEndpoints.add(`${sourceNodeId}\0${targetNodeId}`);
      }
    }
  }
  for (const edge of edges) {
    if (
      edge.relationKinds.includes('aliases')
      && subanalysisInputEndpoints.has(`${edge.sourceNodeId}\0${edge.targetNodeId}`)
    ) {
      edge.projectionRole = 'subanalysis_input';
    }
  }

  // Boundary outputs remain owned by their real ASTRA sub-analysis even when
  // they are projected into the parent graph. Preserve that canonical
  // containment explicitly so every exposed product visibly comes out of its
  // sub-analysis. Multiple grouped outputs collapse to one containment edge.
  for (const output of boundaryOutputs) {
    const sourceNodeId = `scope:${output.scopeId}`;
    const targetNodeId = nodeIdByRecordId.get(output.id);
    if (!targetNodeId || sourceNodeId === targetNodeId) continue;
    const underlyingRelationId = `${output.scopeId}:contains:${output.id}`;
    const existing = edges.find((edge) => (
      edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId
    ));
    if (existing) {
      if (!existing.relationKinds.includes('contains')) {
        existing.relationKinds.push('contains');
        existing.relationKinds.sort();
      }
      if (!existing.underlyingRelationIds.includes(underlyingRelationId)) {
        existing.underlyingRelationIds.push(underlyingRelationId);
      }
      continue;
    }
    edges.push({
      id: `edge:${sourceNodeId}:${targetNodeId}`,
      sourceNodeId,
      targetNodeId,
      relationKinds: ['contains'],
      underlyingRelationIds: [underlyingRelationId],
    });
  }

  return {
    nodes,
    edges,
    scopes,
    focusScopeId: focusScope.id,
    ...(parsed.organization ? { organization: parsed.organization } : {}),
    organizationStatus,
    diagnostics,
    validGroups: validation.validGroups,
  };
}

export interface GraphOrganizerBriefOptions {
  entrypoint?: string;
  organizationPath?: string;
}

function recipeFamily(record: ProjectRecordView): string | undefined {
  if (record.kind !== 'output') return undefined;
  const command = record.recipe?.command?.trim();
  if (!command) return undefined;
  const script = command.match(/(?:^|\s)([^\s'";|]+\.(?:py|r|sh|jl|m))(?:\s|$)/i)?.[1];
  return script ?? command.split(/\s+/).slice(0, 2).join(' ');
}

/** Versioned, self-contained instructions that a host can expose to any agent. */
export function buildGraphOrganizerBrief(
  model: ProjectViewModelV1,
  options: GraphOrganizerBriefOptions = {},
): string {
  const entrypoint = options.entrypoint ?? 'astra.yaml';
  const organizationPath = options.organizationPath ?? '.astra/astra.graph.yaml';
  const index = createProjectViewModelIndex(model);
  const inventory = model.scopes.flatMap((scope) => {
    const records = scope.recordIds
      .map((recordId) => index.recordById.get(recordId))
      .filter((record): record is ProjectRecordView => Boolean(record));
    return [
      `### Scope: ${scope.canonicalPath} — ${scope.name}`,
      ...records.map((record) => {
        const relations = record.relations
          .filter((relation) => FLOW_RELATIONS.has(relation.kind))
          .map((relation) => {
            const target = index.recordById.get(relation.targetRecordId);
            return `${relation.kind}:${target?.canonicalPath ?? relation.targetRecordId}`;
          });
        const description = record.description?.replaceAll('\n', ' ').trim();
        const family = recipeFamily(record);
        return `- ${record.kind} \`${record.localId}\` (path: \`${record.canonicalPath}\`)${record.label ? ` — ${record.label}` : ''}${description ? ` — ${description}` : ''}${family ? `; recipe family: ${family}` : ''}${relations.length ? `; relations: ${relations.join(', ')}` : ''}`;
      }),
      '',
    ];
  }).join('\n');

  return `# ASTRA graph organization brief

This generated brief is presentation guidance, not part of the ASTRA scientific record.

## Your task

Help the scientist organize the graph for \`${entrypoint}\`. First ask what they want the graph to emphasize. Inspect the inventory below, propose groups, and wait for explicit approval before writing \`${organizationPath}\`.

You may only group existing ASTRA records. Do not edit \`${entrypoint}\`, manufacture dependencies, create stages or sub-analyses, or add layout coordinates. ASTRA scopes and every graph edge are derived mechanically by the viewer.

The viewer already projects each real ASTRA sub-analysis as one expandable node in its parent graph and mechanically exposes outputs consumed beyond that scope. Do not create presentation groups to imitate, merge, or rename scopes; groups may compact genuine repeated boundary outputs within their declared child scope.

Balance legibility with completeness:

- The graph mechanically omits prior insights and findings; they remain available in inventory and detail views. Do not create groups for those kinds.
- Keep genuine headline outputs exposed. Headline outputs are downstream scientific summaries, tables, plots, or artifacts supporting findings; repeated per-tracer intermediates are not automatically headline outputs.
- Terminality alone does not make an output headline. Repeated terminal peers may be grouped when they share a semantic role and remain individually reachable by expanding the group.
- Group repeated records only when they play effectively the same semantic role.
- Do not group decisions. The viewer presents every decision mechanically in a compact list and traces one selected decision's direct output links.
- Treat a shared recipe family and semantic role as the primary grouping signal. Similar decision sets and relation patterns are supporting evidence, not strict identity requirements.
- Repeated applications across tracers, bins, or parameterizations should usually be grouped. A tracer-specific decision target or option, such as a different smoothing choice, does not by itself make an otherwise equivalent record an exception.
- Preserve scientifically meaningful comparison axes as separate groups when useful (for example, pre- versus post-reconstruction), while keeping exceptional members exposed.
- Recipe family is supporting evidence, not permission to group records with different analytical roles.
- Keep exceptions outside an otherwise regular family only when their analytical role or scientific prominence genuinely differs.
- Keep all inputs represented; group them only within one real ASTRA scope.
- Treat consequential decisions cautiously and expose them unless they are genuinely repetitive peers.
- Do not group across scopes or record kinds, and do not group records that depend on one another.
- Prefer shallow, non-overlapping groups. When uncertain, leave a record exposed.
- Preserve existing stable group ids when refreshing an organization.

## File contract

Write exactly this schema:

\`\`\`yaml
schema_version: graph-organization.v1
source:
  entrypoint: ${JSON.stringify(entrypoint)}
  organization_input_digest: ${model.revision.analysis}
groups:
  - id: repeated_products
    label: Repeated products
    scope: root
    kind: output
    members:
      - first_output
      - second_output
\`\`\`

Valid kinds are \`input\`, \`decision\`, \`output\`, \`finding\`, and \`prior_insight\`. A member may be its local id or canonical path, but it must resolve uniquely in the declared scope and kind. Every group needs at least two members. Do not add any other top-level keys.

After writing, tell the scientist to return to the graph. The viewer validates the file against the current canonical model, leaves unmentioned records visible, expands invalid groups, and reports staleness.

## Canonical graph inventory

Analysis digest: \`${model.revision.analysis}\`

${inventory}`;
}
