/**
 * Mechanical graph derivation. The graph is a direct structural projection of
 * the canonical view model for one scope: records become nodes, child
 * analyses collapse to one node each, and edges come only from the model's
 * typed relations. Nothing here reads files, guesses at grouping, or asks an
 * agent for help — the render is always correct because it is derived from
 * the model alone.
 */
import type {
  AstraRecordKind,
  ProjectRecordView,
  ProjectScopeView,
  RecordRelationKind,
} from '@astra-spec/sdk/view-model';
import type { InventoryModel } from '../full-inventory/model.js';
import { inventoryRecordTitle } from '../full-inventory/model.js';

export interface GraphRecordNode {
  id: string;
  nodeType: 'record';
  kind: AstraRecordKind;
  label: string;
  record: ProjectRecordView;
  scope: ProjectScopeView;
}

export interface GraphScopeNode {
  id: string;
  nodeType: 'scope';
  kind: 'analysis';
  label: string;
  scope: ProjectScopeView;
  recordCount: number;
}

/**
 * One collapsed organization group. Groups collapse by default — the graph
 * reads at the organization's altitude — and expand (into a frame of member
 * chips) per interaction. Edges to members re-route to the group node.
 */
export interface GraphGroupNode {
  id: string;
  nodeType: 'group';
  /** Dominant member kind: carries the glyph, colour, and rank seed. */
  kind: AstraRecordKind;
  label: string;
  memberRecords: ProjectRecordView[];
  scope: ProjectScopeView;
  /** First member's canonical path — anchors within-layer ordering. */
  anchorPath: string;
}

export type GraphNode = GraphRecordNode | GraphScopeNode | GraphGroupNode;

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  /** Sorted, deduplicated relation kinds this edge aggregates. */
  relationKinds: RecordRelationKind[];
}

export interface GraphOrganizationGroup {
  label: string;
  /** Canonical record paths (for example `outputs.headline`). */
  members: string[];
}

/**
 * Optional presentation overlay, authored outside the viewer (an agent skill
 * at authoring time, a file the host chooses to read). It only ever groups
 * records the mechanical graph already shows: unknown members are silently
 * ignored and it can never add, remove, or rewire ASTRA relations.
 */
export interface GraphOrganization {
  /** Free-form provenance note, e.g. the analysis revision it was written for. */
  basedOn?: string;
  groups: GraphOrganizationGroup[];
}

export interface ResolvedGraphGroup {
  label: string;
  /** Record-node ids present in this projection, in stable member order. */
  nodeIds: string[];
  records: ProjectRecordView[];
}

export interface GraphDerivation {
  scope: ProjectScopeView;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The scope's decisions when they are railed (the default). */
  railDecisions: GraphRecordNode[];
  /** Organization groups that resolved to at least one visible record node. */
  groups: ResolvedGraphGroup[];
  /**
   * Record nodes the overlay left to the mechanical layout. Zero without an
   * organization; hosts use it to render a quiet note.
   */
  unorganizedCount: number;
}

export interface DeriveProjectGraphOptions {
  /** Scope to project; defaults to the root scope. */
  scopeId?: string;
  organization?: GraphOrganization;
  /**
   * Labels of organization groups to expand into member frames. Everything
   * not listed collapses to a single group node.
   */
  expandedGroups?: ReadonlySet<string>;
  /**
   * Decisions read best beside the flow, not inside it (the archived viewer's
   * rail). By default the scope's decisions are excluded from nodes/edges and
   * returned in `railDecisions`; set true to keep them in the flow.
   */
  decisionsInFlow?: boolean;
}

/** Relations that read as flow between records. `contains` is structural. */
const FLOW_RELATIONS = new Set<RecordRelationKind>([
  'depends_on',
  'parameterized_by',
  'informed_by',
  'evidenced_by',
  'aliases',
  'derived_from',
]);

export function graphRecordNodeId(recordId: string): string {
  return `record:${recordId}`;
}

export function graphScopeNodeId(scopeId: string): string {
  return `scope:${scopeId}`;
}

export function graphGroupNodeId(label: string): string {
  return `group-node:${label}`;
}

/** Reading-order weight shared with the layout's rank seeding. */
const KIND_ORDER: AstraRecordKind[] = [
  'input',
  'prior_insight',
  'decision',
  'output',
  'finding',
];

function dominantKind(records: readonly ProjectRecordView[]): AstraRecordKind {
  let kind: AstraRecordKind = records[0]?.kind ?? 'output';
  for (const record of records) {
    if (KIND_ORDER.indexOf(record.kind) > KIND_ORDER.indexOf(kind)) {
      kind = record.kind;
    }
  }
  return kind;
}

function rootScope(model: InventoryModel): ProjectScopeView | undefined {
  return model.model.scopes.find((scope) => !scope.parentId)
    ?? model.model.scopes[0];
}

/** The direct child of `focusId` on the parent chain of `scopeId`, if any. */
function childScopeWithinFocus(
  model: InventoryModel,
  scopeId: string,
  focusId: string,
): ProjectScopeView | undefined {
  let current = model.scopeById.get(scopeId);
  const visited = new Set<string>();
  while (current && current.id !== focusId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === focusId) return current;
    current = current.parentId ? model.scopeById.get(current.parentId) : undefined;
  }
  return undefined;
}

/**
 * Derive the mechanical node/edge projection for one scope: the scope's own
 * records by kind, one collapsed node per child analysis, and edges from the
 * model's direct typed relations. References that do not resolve to a node in
 * this projection are dropped, so unresolved references never make dangling
 * edges.
 */
export function deriveProjectGraph(
  model: InventoryModel,
  options: DeriveProjectGraphOptions = {},
): GraphDerivation {
  const focus = options.scopeId
    ? model.scopeById.get(options.scopeId) ?? rootScope(model)
    : rootScope(model);
  if (!focus) {
    return {
      scope: emptyScope(),
      nodes: [],
      edges: [],
      railDecisions: [],
      groups: [],
      unorganizedCount: 0,
    };
  }

  const nodes: GraphNode[] = [];
  const railDecisions: GraphRecordNode[] = [];
  const nodeIdByRecordId = new Map<string, string>();

  for (const recordId of focus.recordIds) {
    const record = model.recordById.get(recordId);
    if (!record) continue;
    const node: GraphRecordNode = {
      id: graphRecordNodeId(record.id),
      nodeType: 'record',
      kind: record.kind,
      label: inventoryRecordTitle(record),
      record,
      scope: focus,
    };
    if (record.kind === 'decision' && !options.decisionsInFlow) {
      railDecisions.push(node);
      continue;
    }
    nodeIdByRecordId.set(record.id, node.id);
    nodes.push(node);
  }

  for (const childId of focus.childIds) {
    const child = model.scopeById.get(childId);
    if (!child) continue;
    nodes.push({
      id: graphScopeNodeId(child.id),
      nodeType: 'scope',
      kind: 'analysis',
      label: child.name,
      scope: child,
      recordCount: child.recordIds.length,
    });
  }

  // Records inside a child analysis (at any depth) collapse onto that child's
  // scope node, so their cross-boundary relations surface as scope edges.
  for (const record of model.model.records) {
    if (nodeIdByRecordId.has(record.id)) continue;
    const child = childScopeWithinFocus(model, record.scopeId, focus.id);
    if (child) nodeIdByRecordId.set(record.id, graphScopeNodeId(child.id));
  }

  const { groups: resolvedGroups, unorganizedCount } = resolveOrganization(
    model,
    nodes,
    options.organization,
  );

  // Collapse every group the host has not expanded: one node per group, its
  // member chips removed and their record ids remapped so relations re-route
  // to the group node (intra-group relations vanish as self-edges).
  const expanded = options.expandedGroups ?? new Set<string>();
  const frames: ResolvedGraphGroup[] = [];
  const collapsedNodeIds = new Set<string>();
  for (const group of resolvedGroups) {
    if (expanded.has(group.label)) {
      frames.push(group);
      continue;
    }
    const nodeId = graphGroupNodeId(group.label);
    for (const member of group.records) {
      collapsedNodeIds.add(graphRecordNodeId(member.id));
      nodeIdByRecordId.set(member.id, nodeId);
    }
    nodes.push({
      id: nodeId,
      nodeType: 'group',
      kind: dominantKind(group.records),
      label: group.label,
      memberRecords: group.records,
      scope: focus,
      anchorPath: group.records[0]?.canonicalPath ?? group.label,
    });
  }
  const visibleNodes = collapsedNodeIds.size
    ? nodes.filter((node) => !collapsedNodeIds.has(node.id))
    : nodes;

  const byEndpoints = new Map<string, Set<RecordRelationKind>>();
  for (const record of model.model.records) {
    const targetNodeId = nodeIdByRecordId.get(record.id);
    if (!targetNodeId) continue;
    for (const relation of record.relations) {
      if (!FLOW_RELATIONS.has(relation.kind)) continue;
      // Transitive provenance is kept for detail views; drawing it here makes
      // upstream roots look like immediate inputs of every downstream product.
      if (relation.direct === false) continue;
      // Unresolved or out-of-projection references make no edge.
      const sourceNodeId = nodeIdByRecordId.get(relation.targetRecordId);
      if (!sourceNodeId || sourceNodeId === targetNodeId) continue;
      const key = `${sourceNodeId}\0${targetNodeId}`;
      const kinds = byEndpoints.get(key) ?? new Set<RecordRelationKind>();
      kinds.add(relation.kind);
      byEndpoints.set(key, kinds);
    }
  }

  const edges = [...byEndpoints.entries()]
    .map(([key, kinds]) => {
      const [sourceId, targetId] = key.split('\0') as [string, string];
      return {
        id: `edge:${sourceId}:${targetId}`,
        sourceId,
        targetId,
        relationKinds: [...kinds].sort(),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    scope: focus,
    nodes: visibleNodes,
    edges,
    railDecisions,
    groups: frames,
    unorganizedCount,
  };
}

/**
 * Resolve overlay members (canonical record paths) against the record nodes
 * this projection actually shows. Unknown members, members collapsed inside a
 * child analysis, and members already claimed by an earlier group are all
 * silently ignored — the overlay may only regroup what is already there.
 */
function resolveOrganization(
  model: InventoryModel,
  nodes: readonly GraphNode[],
  organization: GraphOrganization | undefined,
): { groups: ResolvedGraphGroup[]; unorganizedCount: number } {
  const recordNodeIds = new Set(
    nodes.filter((node) => node.nodeType === 'record').map((node) => node.id),
  );
  if (!organization) return { groups: [], unorganizedCount: 0 };

  const claimed = new Set<string>();
  const groups: ResolvedGraphGroup[] = [];
  for (const group of organization.groups) {
    const nodeIds: string[] = [];
    const records: ProjectRecordView[] = [];
    for (const member of group.members) {
      const located = model.recordByPath.get(member.trim());
      if (!located) continue;
      const nodeId = graphRecordNodeId(located.record.id);
      if (!recordNodeIds.has(nodeId) || claimed.has(nodeId)) continue;
      claimed.add(nodeId);
      nodeIds.push(nodeId);
      records.push(located.record);
    }
    if (nodeIds.length) groups.push({ label: group.label, nodeIds, records });
  }
  return { groups, unorganizedCount: recordNodeIds.size - claimed.size };
}

function emptyScope(): ProjectScopeView {
  return { id: 'root', canonicalPath: 'root', name: '', childIds: [], recordIds: [] };
}
