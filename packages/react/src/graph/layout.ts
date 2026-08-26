/**
 * Deterministic layered layout for the mechanical graph. Ranks follow the
 * record kinds' natural reading order (sources above products) and are pushed
 * down by the longest dependency path; every tie is broken lexically so the
 * same model always lays out identically.
 *
 * When the derivation carries organization groups, each group becomes one
 * layout unit: its members cluster in a compact grid under the group label
 * while everything else keeps its mechanical position.
 */
import type {
  GraphDerivation,
  GraphEdge,
  GraphNode,
  ResolvedGraphGroup,
} from './model.js';

export const GRAPH_NODE_WIDTH = 216;
export const GRAPH_NODE_HEIGHT = 52;

const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 88;
const CANVAS_PADDING = 48;
const GROUP_COLUMNS = 3;
const GROUP_PADDING = 14;
const GROUP_HEADER = 30;
const GROUP_INNER_GAP_X = 14;
const GROUP_INNER_GAP_Y = 12;

export interface GraphNodePosition {
  x: number;
  y: number;
}

/** Absolute frame of one organization group, sized around its members. */
export interface GraphGroupFrame {
  label: string;
  nodeIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayout {
  /** Absolute top-left positions keyed by node id. */
  positions: ReadonlyMap<string, GraphNodePosition>;
  groups: GraphGroupFrame[];
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
    : node.nodeType === 'group'
      ? node.anchorPath
      : node.scope.canonicalPath;
  return `${kindOrder.indexOf(node.kind)}:${canonicalPath}`;
}

/** One layout unit: a single node, or an organization group of record nodes. */
interface LayoutUnit {
  id: string;
  nodes: GraphNode[];
  group?: ResolvedGraphGroup;
  width: number;
  height: number;
  sortKey: string;
}

function groupGrid(count: number): { columns: number; rows: number } {
  const columns = Math.max(1, Math.min(GROUP_COLUMNS, count));
  return { columns, rows: Math.ceil(count / columns) };
}

function buildUnits(
  nodes: readonly GraphNode[],
  groups: readonly ResolvedGraphGroup[],
): { units: LayoutUnit[]; unitByNodeId: Map<string, LayoutUnit> } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const units: LayoutUnit[] = [];
  const unitByNodeId = new Map<string, LayoutUnit>();

  groups.forEach((group, index) => {
    const members = group.nodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is GraphNode => Boolean(node))
      .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)));
    if (!members.length) return;
    const { columns, rows } = groupGrid(members.length);
    const unit: LayoutUnit = {
      id: `group:${index}`,
      nodes: members,
      group,
      width: GROUP_PADDING * 2
        + columns * GRAPH_NODE_WIDTH
        + (columns - 1) * GROUP_INNER_GAP_X,
      height: GROUP_HEADER
        + rows * GRAPH_NODE_HEIGHT
        + (rows - 1) * GROUP_INNER_GAP_Y
        + GROUP_PADDING,
      // A group sorts where its first member would have sorted, so it stays
      // near its mechanical peers.
      sortKey: nodeSortKey(members[0]!),
    };
    units.push(unit);
    for (const member of members) unitByNodeId.set(member.id, unit);
  });

  for (const node of nodes) {
    if (unitByNodeId.has(node.id)) continue;
    const unit: LayoutUnit = {
      id: node.id,
      nodes: [node],
      width: GRAPH_NODE_WIDTH,
      height: GRAPH_NODE_HEIGHT,
      sortKey: nodeSortKey(node),
    };
    units.push(unit);
    unitByNodeId.set(node.id, unit);
  }

  return { units, unitByNodeId };
}

/**
 * Longest-path ranks seeded by record kind (ported from the archived layered
 * layout), computed over layout units: a unit sits at least one layer below
 * every direct dependency, and cycles simply keep their seed rank.
 */
function unitRanks(
  units: readonly LayoutUnit[],
  unitByNodeId: ReadonlyMap<string, LayoutUnit>,
  edges: readonly GraphEdge[],
): ReadonlyMap<string, number> {
  const seed = (unit: LayoutUnit): number =>
    Math.max(...unit.nodes.map((node) => kindRank(node)));
  const ranks = new Map(units.map((unit) => [unit.id, seed(unit)]));

  interface UnitEdge { sourceId: string; targetId: string }
  const unitEdges: UnitEdge[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    // Aliases are naming relations, not dataflow: a collapsed child analysis
    // both consumes and re-exports aliased records, which would otherwise
    // knot the ranking into a cycle. They are still drawn, just not
    // rank-forcing.
    if (!edge.relationKinds.some((kind) => kind !== 'aliases')) continue;
    const source = unitByNodeId.get(edge.sourceId);
    const target = unitByNodeId.get(edge.targetId);
    if (!source || !target || source.id === target.id) continue;
    const key = `${source.id}\0${target.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unitEdges.push({ sourceId: source.id, targetId: target.id });
  }

  const indegree = new Map(units.map((unit) => [unit.id, 0]));
  const outgoing = new Map<string, UnitEdge[]>();
  for (const edge of unitEdges) {
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
    const next = outgoing.get(edge.sourceId) ?? [];
    next.push(edge);
    outgoing.set(edge.sourceId, next);
  }
  const pending = units
    .filter((unit) => indegree.get(unit.id) === 0)
    .map((unit) => unit.id);
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
  const { units, unitByNodeId } = buildUnits(derivation.nodes, derivation.groups);
  const ranks = unitRanks(units, unitByNodeId, derivation.edges);

  const layers = new Map<number, LayoutUnit[]>();
  for (const unit of units) {
    const rank = ranks.get(unit.id) ?? 0;
    const layer = layers.get(rank) ?? [];
    layer.push(unit);
    layers.set(rank, layer);
  }
  const layerEntries = [...layers.entries()].sort(([left], [right]) => left - right);
  for (const [, layer] of layerEntries) {
    layer.sort((left, right) =>
      left.sortKey.localeCompare(right.sortKey) || left.id.localeCompare(right.id));
  }

  const layerWidth = (layer: readonly LayoutUnit[]): number =>
    layer.reduce((total, unit) => total + unit.width, 0)
    + Math.max(0, layer.length - 1) * HORIZONTAL_GAP;
  const widest = Math.max(0, ...layerEntries.map(([, layer]) => layerWidth(layer)));

  const positions = new Map<string, GraphNodePosition>();
  const frames: GraphGroupFrame[] = [];
  let y = CANVAS_PADDING;
  for (const [, layer] of layerEntries) {
    const layerHeight = Math.max(...layer.map((unit) => unit.height));
    let x = CANVAS_PADDING + (widest - layerWidth(layer)) / 2;
    for (const unit of layer) {
      const unitY = y + (layerHeight - unit.height) / 2;
      if (unit.group) {
        frames.push({
          label: unit.group.label,
          nodeIds: unit.nodes.map((node) => node.id),
          x,
          y: unitY,
          width: unit.width,
          height: unit.height,
        });
        const { columns } = groupGrid(unit.nodes.length);
        unit.nodes.forEach((node, index) => {
          positions.set(node.id, {
            x: x + GROUP_PADDING
              + (index % columns) * (GRAPH_NODE_WIDTH + GROUP_INNER_GAP_X),
            y: unitY + GROUP_HEADER
              + Math.floor(index / columns) * (GRAPH_NODE_HEIGHT + GROUP_INNER_GAP_Y),
          });
        });
      } else {
        positions.set(unit.nodes[0]!.id, { x, y: unitY });
      }
      x += unit.width + HORIZONTAL_GAP;
    }
    y += layerHeight + VERTICAL_GAP;
  }

  return {
    positions,
    groups: frames,
    width: widest + CANVAS_PADDING * 2,
    // After the loop `y` sits one gap below the last layer's bottom edge.
    height: (layerEntries.length ? y - VERTICAL_GAP : y) + CANVAS_PADDING,
  };
}
