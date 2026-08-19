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

export type GraphNode = GraphRecordNode | GraphScopeNode;

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  /** Sorted, deduplicated relation kinds this edge aggregates. */
  relationKinds: RecordRelationKind[];
}

export interface GraphDerivation {
  scope: ProjectScopeView;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DeriveProjectGraphOptions {
  /** Scope to project; defaults to the root scope. */
  scopeId?: string;
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
  if (!focus) return { scope: emptyScope(), nodes: [], edges: [] };

  const nodes: GraphNode[] = [];
  const nodeIdByRecordId = new Map<string, string>();

  for (const recordId of focus.recordIds) {
    const record = model.recordById.get(recordId);
    if (!record) continue;
    const nodeId = graphRecordNodeId(record.id);
    nodeIdByRecordId.set(record.id, nodeId);
    nodes.push({
      id: nodeId,
      nodeType: 'record',
      kind: record.kind,
      label: inventoryRecordTitle(record),
      record,
      scope: focus,
    });
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

  return { scope: focus, nodes, edges };
}

function emptyScope(): ProjectScopeView {
  return { id: 'root', canonicalPath: 'root', name: '', childIds: [], recordIds: [] };
}
