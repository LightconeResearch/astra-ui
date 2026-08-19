/**
 * Deterministic layered layout for the mechanical graph. Ranks follow the
 * record kinds' natural reading order (sources above products) and are pushed
 * down by the longest dependency path; every tie is broken lexically so the
 * same model always lays out identically.
 */
import type { GraphDerivation, GraphEdge, GraphNode } from './model.js';

export const GRAPH_NODE_WIDTH = 216;
export const GRAPH_NODE_HEIGHT = 52;

const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 88;
const CANVAS_PADDING = 48;

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphLayout {
  /** Absolute top-left positions keyed by node id. */
  positions: ReadonlyMap<string, GraphNodePosition>;
  width: number;
  height: number;
}

function kindRank(node: GraphNode): number {
  if (node.kind === 'input' || node.kind === 'prior_insight') return 0;
  if (node.kind === 'decision' || node.kind === 'analysis') return 1;
  if (node.kind === 'output') return 2;
  return 3;
}

/** Stable within-layer ordering: sources first, then by canonical path. */
function nodeSortKey(node: GraphNode): string {
  const kindOrder = ['input', 'prior_insight', 'decision', 'analysis', 'output', 'finding'];
  const canonicalPath = node.nodeType === 'record'
    ? node.record.canonicalPath
    : node.scope.canonicalPath;
  return `${kindOrder.indexOf(node.kind)}:${canonicalPath}`;
}

/**
 * Longest-path ranks seeded by record kind (ported from the archived layered
 * layout): a node sits at least one layer below every direct dependency, and
 * cycles simply keep their seed rank.
 */
function nodeRanks(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): ReadonlyMap<string, number> {
  const ranks = new Map(nodes.map((node) => [node.id, kindRank(node)]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
    const next = outgoing.get(edge.sourceId) ?? [];
    next.push(edge);
    outgoing.set(edge.sourceId, next);
  }
  const pending = nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  while (pending.length) {
    const source = pending.shift()!;
    for (const edge of outgoing.get(source) ?? []) {
      ranks.set(
        edge.targetId,
        Math.max(ranks.get(edge.targetId) ?? 0, (ranks.get(source) ?? 0) + 1),
      );
      const nextIndegree = (indegree.get(edge.targetId) ?? 1) - 1;
      indegree.set(edge.targetId, nextIndegree);
      if (nextIndegree === 0) pending.push(edge.targetId);
    }
  }
  return ranks;
}

export function layoutProjectGraph(derivation: GraphDerivation): GraphLayout {
  const { nodes, edges } = derivation;
  // Aliases are naming relations, not dataflow: a collapsed child analysis
  // both consumes and re-exports aliased records, which would otherwise knot
  // the ranking into a cycle. They are still drawn, just not rank-forcing.
  const ranking = edges.filter(
    (edge) => edge.relationKinds.some((kind) => kind !== 'aliases'),
  );
  const ranks = nodeRanks(nodes, ranking);

  const layers = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const rank = ranks.get(node.id) ?? kindRank(node);
    const layer = layers.get(rank) ?? [];
    layer.push(node);
    layers.set(rank, layer);
  }
  const layerEntries = [...layers.entries()].sort(([left], [right]) => left - right);
  for (const [, layer] of layerEntries) {
    layer.sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)));
  }

  const layerWidth = (layer: readonly GraphNode[]): number =>
    layer.length * GRAPH_NODE_WIDTH + Math.max(0, layer.length - 1) * HORIZONTAL_GAP;
  const widest = Math.max(0, ...layerEntries.map(([, layer]) => layerWidth(layer)));

  const positions = new Map<string, GraphNodePosition>();
  let y = CANVAS_PADDING;
  for (const [, layer] of layerEntries) {
    let x = CANVAS_PADDING + (widest - layerWidth(layer)) / 2;
    for (const node of layer) {
      positions.set(node.id, { x, y });
      x += GRAPH_NODE_WIDTH + HORIZONTAL_GAP;
    }
    y += GRAPH_NODE_HEIGHT + VERTICAL_GAP;
  }

  return {
    positions,
    width: widest + CANVAS_PADDING * 2,
    // After the loop `y` sits one gap below the last layer's bottom edge.
    height: (layerEntries.length ? y - VERTICAL_GAP : y) + CANVAS_PADDING,
  };
}
