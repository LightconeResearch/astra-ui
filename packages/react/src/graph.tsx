import {
  createAstraGraphViewProjection,
  type AstraGraphEdge,
  type AstraGraphEdgeKind,
  type AstraGraphNode,
  type AstraGraphProjectionV1,
  type AstraGraphViewSpecV1,
  type ViewerOpenReference,
} from '@lightcone-research/astra-viewer-model';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from 'react';

const PRIMARY_EDGE_KINDS = new Set<AstraGraphEdgeKind>([
  'flow',
  'produces',
  'supports',
  'concludes',
]);

const NODE_COLORS: Record<AstraGraphNode['kind'], string> = {
  analysis: 'var(--astra-c-analysis)',
  input: 'var(--astra-c-input)',
  'input-group': 'var(--astra-c-input)',
  output: 'var(--astra-c-output)',
  'output-group': 'var(--astra-c-output)',
  'decision-cluster': 'var(--astra-c-decision)',
  decision: 'var(--astra-c-decision)',
  finding: 'var(--astra-c-finding)',
  'finding-group': 'var(--astra-c-finding)',
  'prior-insight': 'var(--astra-c-insight)',
  result: 'var(--astra-c-result)',
};

interface EdgeStyle {
  color: string;
  width: number;
  dash?: string;
}

const EDGE_STYLES: Record<AstraGraphEdgeKind, EdgeStyle> = {
  flow: { color: 'var(--astra-graph-flow)', width: 1.45 },
  produces: { color: 'var(--astra-graph-flow)', width: 1.45 },
  configures: { color: 'var(--astra-c-decision)', width: 1.35, dash: '3 4' },
  inherits: { color: 'var(--astra-c-decision)', width: 1.45 },
  locks: { color: 'var(--astra-c-danger)', width: 1.4, dash: '2 3' },
  requires: { color: 'var(--astra-c-danger)', width: 1.4, dash: '7 3' },
  supports: { color: 'var(--astra-c-finding)', width: 1.45, dash: '6 3' },
  informs: { color: 'var(--astra-c-insight)', width: 1.3, dash: '1 3' },
  concludes: { color: 'var(--astra-c-finding)', width: 1.8 },
};

interface PositionedNode extends AstraGraphNode {
  x: number;
  y: number;
}

interface ClusterBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: AstraGraphEdge[];
  byId: ReadonlyMap<string, PositionedNode>;
  clusterBoxes: ClusterBox[];
}

interface GraphCamera {
  x: number;
  y: number;
  scale: number;
}

interface GraphViewportSize {
  width: number;
  height: number;
}

const MIN_GRAPH_SCALE = 0.35;
const MAX_GRAPH_SCALE = 2.5;

function clampGraphScale(scale: number): number {
  return Math.min(MAX_GRAPH_SCALE, Math.max(MIN_GRAPH_SCALE, scale));
}

function fitGraphCamera(
  layout: Pick<GraphLayout, 'width' | 'height'>,
  viewport: GraphViewportSize,
): GraphCamera {
  const padding = 48;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = clampGraphScale(Math.min(
    1,
    availableWidth / layout.width,
    availableHeight / layout.height,
  ));
  return {
    x: (viewport.width - layout.width * scale) / 2,
    y: (viewport.height - layout.height * scale) / 2,
    scale,
  };
}

function zoomGraphCamera(
  camera: GraphCamera,
  nextScale: number,
  anchor: { x: number; y: number },
): GraphCamera {
  const scale = clampGraphScale(nextScale);
  const graphX = (anchor.x - camera.x) / camera.scale;
  const graphY = (anchor.y - camera.y) / camera.scale;
  return {
    x: anchor.x - graphX * scale,
    y: anchor.y - graphY * scale,
    scale,
  };
}

export interface AstraGraphViewProps {
  projection: AstraGraphProjectionV1;
  view?: AstraGraphViewSpecV1;
  title?: string;
  minWidth?: number;
  initialShowPriorInsights?: boolean;
  showLegend?: boolean;
  showInspector?: boolean;
  onSelectNode?: (node: AstraGraphNode) => void;
  onOpenReference?: (reference: ViewerOpenReference) => void;
  onReferenceInChat?: (reference: ViewerOpenReference) => void;
}

function visibleGraph(
  projection: AstraGraphProjectionV1,
  expanded: ReadonlySet<string>,
  showPriorInsights: boolean,
): { nodes: AstraGraphNode[]; edges: AstraGraphEdge[] } {
  const nodes = projection.nodes.filter((node) => {
    if (node.kind === 'prior-insight') return showPriorInsights;
    if (node.kind === 'decision') {
      return Boolean(node.parentId && expanded.has(node.parentId));
    }
    return true;
  });
  const visible = new Set(nodes.map((node) => node.id));
  const edges = projection.edges.filter((edge) => {
    if (!visible.has(edge.source) || !visible.has(edge.target)) return false;
    if (edge.parentId) return expanded.has(edge.parentId);
    const source = projection.nodes.find((node) => node.id === edge.source);
    if (source?.kind === 'decision-cluster' && expanded.has(source.id)) return false;
    return edge.kind !== 'informs' || showPriorInsights;
  });
  return { nodes, edges };
}

function topologicalRanks(
  nodes: readonly AstraGraphNode[],
  edges: readonly AstraGraphEdge[],
): Map<string, number> {
  const baseNodes = nodes.filter((node) =>
    node.kind !== 'decision'
    && node.kind !== 'decision-cluster'
    && node.kind !== 'prior-insight');
  const ids = new Set(baseNodes.map((node) => node.id));
  const ranks = new Map(baseNodes.map((node) => [node.id, 0]));
  const incoming = new Map(baseNodes.map((node) => [node.id, 0]));
  const outgoing = new Map(baseNodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (
      !PRIMARY_EDGE_KINDS.has(edge.kind)
      || !ids.has(edge.source)
      || !ids.has(edge.target)
    ) continue;
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const queue = baseNodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    visited.add(id);
    for (const target of outgoing.get(id) ?? []) {
      ranks.set(target, Math.max(
        ranks.get(target) ?? 0,
        (ranks.get(id) ?? 0) + 1,
      ));
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  let fallbackRank = Math.max(0, ...ranks.values());
  for (const node of baseNodes) {
    if (!visited.has(node.id)) ranks.set(node.id, ++fallbackRank);
  }
  return ranks;
}

function layoutGraph(
  projection: AstraGraphProjectionV1,
  expanded: ReadonlySet<string>,
  showPriorInsights: boolean,
  minWidth: number,
): GraphLayout {
  const visible = visibleGraph(projection, expanded, showPriorInsights);
  const ranks = topologicalRanks(visible.nodes, visible.edges);
  const baseNodes = visible.nodes.filter((node) =>
    node.kind !== 'decision'
    && node.kind !== 'decision-cluster'
    && node.kind !== 'prior-insight');
  const layers = new Map<number, AstraGraphNode[]>();
  for (const node of baseNodes) {
    const rank = ranks.get(node.id) ?? 0;
    const layer = layers.get(rank) ?? [];
    layer.push(node);
    layers.set(rank, layer);
  }
  const entries = [...layers.entries()].sort(([left], [right]) => left - right);
  const horizontalGap = 240;
  const verticalGap = 110;
  const leftGutter = showPriorInsights ? 300 : 260;
  const margin = 62;
  const maxLayer = Math.max(1, ...entries.map(([, layer]) => layer.length));
  const width = Math.max(
    minWidth,
    leftGutter + (Math.min(maxLayer, 6) - 1) * horizontalGap + 300,
  );
  const positions = new Map<string, PositionedNode>();
  for (const [rank, layer] of entries) {
    layer.sort((left, right) =>
      (left.layout?.order ?? Number.MAX_SAFE_INTEGER)
      - (right.layout?.order ?? Number.MAX_SAFE_INTEGER)
      || left.scopeId.localeCompare(right.scopeId)
      || left.label.localeCompare(right.label));
    const gap = layer.length > 4
      ? Math.max(115, Math.min(
          horizontalGap,
          (width - leftGutter - 150) / (layer.length - 1),
        ))
      : horizontalGap;
    const span = (layer.length - 1) * gap;
    const start = leftGutter + (width - leftGutter - span) / 2;
    layer.forEach((node, index) => {
      const laneOffset = node.layout?.lane === 'far-left'
        ? -240
        : node.layout?.lane === 'left'
          ? -120
          : node.layout?.lane === 'right'
            ? 60
            : node.layout?.lane === 'far-right'
              ? 120
              : 0;
      positions.set(node.id, {
        ...node,
        x: Math.max(42, Math.min(width - 150, start + index * gap + laneOffset)),
        y: margin + rank * verticalGap,
      });
    });
  }

  const clusterBoxes: ClusterBox[] = [];
  for (const cluster of visible.nodes.filter(
    (node) => node.kind === 'decision-cluster',
  )) {
    const target = cluster.targetId ? positions.get(cluster.targetId) : undefined;
    if (!target) continue;
    const isExpanded = expanded.has(cluster.id);
    const members = visible.nodes.filter((node) => node.parentId === cluster.id);
    if (!isExpanded) {
      positions.set(cluster.id, {
        ...cluster,
        x: Math.max(38, target.x - 190),
        y: target.y,
      });
      continue;
    }
    const rowHeight = 27;
    const boxHeight = 42 + members.length * rowHeight;
    const boxY = Math.max(18, target.y - boxHeight / 2);
    const boxX = Math.max(20, target.x - 470);
    clusterBoxes.push({
      id: cluster.id,
      x: boxX,
      y: boxY,
      width: 280,
      height: boxHeight,
    });
    positions.set(cluster.id, {
      ...cluster,
      x: boxX + 16,
      y: boxY + 20,
    });
    members.forEach((member, index) => {
      positions.set(member.id, {
        ...member,
        x: boxX + 24,
        y: boxY + 49 + index * rowHeight,
      });
    });
  }

  if (showPriorInsights) {
    visible.nodes
      .filter((node) => node.kind === 'prior-insight')
      .forEach((insight, index) => {
        positions.set(insight.id, {
          ...insight,
          x: 30,
          y: margin + index * 52,
        });
      });
  }
  const height = Math.max(
    520,
    ...[...positions.values()].map((node) => node.y + 92),
    ...clusterBoxes.map((box) => box.y + box.height + 30),
  );
  const positioned = visible.nodes.flatMap((node) => {
    const position = positions.get(node.id);
    return position ? [position] : [];
  });
  return {
    width,
    height,
    nodes: positioned,
    edges: visible.edges,
    byId: new Map(positioned.map((node) => [node.id, node])),
    clusterBoxes,
  };
}

function shortLabel(label: string, max = 38): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function edgePath(source: PositionedNode, target: PositionedNode): string {
  const sourceRadius = source.kind === 'decision' || source.kind === 'decision-cluster'
    ? 8
    : 12;
  const targetRadius = target.kind === 'decision' || target.kind === 'decision-cluster'
    ? 8
    : 12;
  if (Math.abs(source.y - target.y) < 35) {
    const direction = source.x <= target.x ? 1 : -1;
    return `M ${source.x + direction * sourceRadius} ${source.y} L ${target.x - direction * targetRadius} ${target.y}`;
  }
  const downward = target.y >= source.y;
  const y1 = source.y + (downward ? sourceRadius : -sourceRadius);
  const y2 = target.y - (downward ? targetRadius : -targetRadius);
  const middle = y1 + (y2 - y1) * 0.52;
  return `M ${source.x} ${y1} C ${source.x} ${middle}, ${target.x} ${middle}, ${target.x} ${y2}`;
}

function referenceForNode(node: AstraGraphNode): ViewerOpenReference | undefined {
  if (!node.recordId || !node.canonicalPath) return undefined;
  const kind = node.kind === 'prior-insight'
    ? 'prior_insight'
    : node.kind === 'input'
      ? 'input'
      : node.kind === 'output'
        ? 'output'
        : node.kind === 'decision'
          ? 'decision'
          : node.kind === 'finding'
            ? 'finding'
            : undefined;
  return kind ? {
    kind,
    id: node.recordId,
    canonicalPath: node.canonicalPath,
  } : undefined;
}

function referenceForMember(
  node: AstraGraphNode,
  canonicalPath: string,
): ViewerOpenReference | undefined {
  const kind = node.kind === 'input-group'
    ? 'input'
    : node.kind === 'output-group'
      ? 'output'
      : node.kind === 'finding-group'
        ? 'finding'
        : undefined;
  return kind ? {
    kind,
    id: canonicalPath.split('.').at(-1) ?? canonicalPath,
    canonicalPath,
  } : undefined;
}

function GraphInspector({
  node,
  projection,
  onOpenReference,
  onReferenceInChat,
}: {
  node?: AstraGraphNode;
  projection: AstraGraphProjectionV1;
  onOpenReference?: (reference: ViewerOpenReference) => void;
  onReferenceInChat?: (reference: ViewerOpenReference) => void;
}): ReactElement {
  if (!node) {
    return (
      <aside className="astra-graph-overlay astra-graph-inspector">
        <strong>Hover or select a node</strong>
        <p>Its ASTRA path, provenance role and selected options will appear here.</p>
      </aside>
    );
  }
  const reference = referenceForNode(node);
  const informing = projection.edges
    .filter((edge) => edge.kind === 'informs' && edge.target === node.id)
    .flatMap((edge) => {
      const insight = projection.nodes.find((candidate) => candidate.id === edge.source);
      return insight ? [insight] : [];
    });
  return (
    <aside className="astra-graph-overlay astra-graph-inspector" aria-label="Selected graph record">
      <header>
        <span
          className="astra-graph-kind"
          style={{ '--astra-graph-kind': NODE_COLORS[node.kind] } as CSSProperties}
        >
          {node.kind.replace('-group', '')}
        </span>
        <strong>{node.title ?? node.label}</strong>
      </header>
      <code>{node.canonicalPath ?? (node.synthetic ? 'Display aggregation' : '')}</code>
      {node.description ? <p>{node.description}</p> : null}
      {node.meta.length ? (
        <ul className="astra-graph-meta">
          {node.meta.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {node.options?.length ? (
        <ul className="astra-graph-options" aria-label="Decision options">
          {node.options.map((option) => (
            <li
              key={option.id}
              data-selected={option.selected}
              data-excluded={option.excluded ?? false}
              title={option.description}
            >
              <span>{option.selected ? '●' : '○'}</span>
              <span>
                {option.label ?? humanize(option.id)}
                {option.exclusionReason ? ` — ${option.exclusionReason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {node.memberPaths?.length && !node.kind.startsWith('decision') ? (
        <div className="astra-graph-members">
          <span>Records</span>
          <ul>
            {node.memberPaths.map((path) => {
              const memberReference = referenceForMember(node, path);
              return (
                <li key={path}>
                  <button
                    type="button"
                    disabled={!memberReference || !onOpenReference}
                    onClick={() => {
                      if (memberReference) onOpenReference?.(memberReference);
                    }}
                  >
                    {path.split('.').at(-1)?.replace(/[_-]+/g, ' ') ?? path}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {informing.length ? (
        <div className="astra-graph-informed">
          <span>Informed by</span>
          {informing.map((insight) => (
            <div key={insight.id}>{insight.label}</div>
          ))}
        </div>
      ) : null}
      {reference && (onOpenReference || onReferenceInChat) ? (
        <footer>
          {onOpenReference ? (
            <button type="button" onClick={() => onOpenReference(reference)}>
              Open details
            </button>
          ) : null}
          {onReferenceInChat ? (
            <button type="button" onClick={() => onReferenceInChat(reference)}>
              Reference in chat
            </button>
          ) : null}
        </footer>
      ) : null}
    </aside>
  );
}

function GraphLegend({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const entries: Array<[AstraGraphEdgeKind, string]> = [
    ['flow', 'data / artifact flow'],
    ['configures', 'decision configures'],
    ['inherits', 'inherited value'],
    ['locks', 'constraint / lock'],
    ['supports', 'supports a finding'],
    ['concludes', 'concludes in result'],
  ];
  return (
    <aside className="astra-graph-overlay astra-graph-legend">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        <span>Graph grammar</span>
        <span>{open ? '▾ collapse' : '▸ expand'}</span>
      </button>
      {open ? (
        <div>
          {entries.map(([kind, label]) => (
            <p key={kind}>
              <span
                className={EDGE_STYLES[kind].dash ? 'is-dashed' : undefined}
                style={{ '--astra-graph-edge': EDGE_STYLES[kind].color } as CSSProperties}
              />
              {label}
            </p>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function AstraGraphView({
  projection,
  view,
  title,
  minWidth = 1040,
  initialShowPriorInsights = false,
  showLegend = true,
  showInspector = true,
  onSelectNode,
  onOpenReference,
  onReferenceInChat,
}: AstraGraphViewProps): ReactElement {
  const renderedProjection = useMemo(
    () => view ? createAstraGraphViewProjection(projection, view) : projection,
    [projection, view],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  const [legendOpen, setLegendOpen] = useState(false);
  const [showPriorInsights] = useState(initialShowPriorInsights);
  const [viewportSize, setViewportSize] = useState<GraphViewportSize>({
    width: 0,
    height: 0,
  });
  const [camera, setCamera] = useState<GraphCamera>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraInitializedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  }>();
  const markerPrefix = `astraGraph${useId().replace(/:/g, '')}`;
  const layout = useMemo(
    () => layoutGraph(renderedProjection, expanded, showPriorInsights, minWidth),
    [expanded, minWidth, renderedProjection, showPriorInsights],
  );
  const selectedNode = renderedProjection.nodes.find((node) => node.id === selectedId);
  const inspectorNode = renderedProjection.nodes.find((node) => node.id === hoveredId)
    ?? selectedNode;

  useEffect(() => {
    if (selectedId && !renderedProjection.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(undefined);
    }
    setExpanded((current) => new Set(
      [...current].filter((id) =>
        renderedProjection.nodes.some((node) =>
          node.id === id && node.kind === 'decision-cluster')),
    ));
  }, [renderedProjection, selectedId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = (): void => {
      const next = {
        width: Math.max(1, viewport.clientWidth),
        height: Math.max(1, viewport.clientHeight),
      };
      setViewportSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      cameraInitializedRef.current
      || viewportSize.width <= 1
      || viewportSize.height <= 1
    ) return;
    setCamera(fitGraphCamera(layout, viewportSize));
    cameraInitializedRef.current = true;
  }, [layout, viewportSize]);

  const resetCamera = (): void => {
    setCamera(fitGraphCamera(layout, viewportSize));
  };

  const zoomFromCenter = (factor: number): void => {
    const anchor = {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    };
    setCamera((current) => zoomGraphCamera(
      current,
      current.scale * factor,
      anchor,
    ));
  };

  const onGraphPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    const target = event.target as Element;
    if (event.button !== 0 || target.closest?.('.astra-graph-node')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsPanning(true);
  };

  const onGraphPointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setCamera((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    }));
  };

  const endGraphPan = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onGraphWheel = (event: ReactWheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    const deltaUnit = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? Math.max(1, viewportSize.height)
        : 1;
    const deltaX = event.deltaX * deltaUnit;
    const deltaY = event.deltaY * deltaUnit;

    // Trackpad pinches are exposed as Ctrl+wheel by browsers. Keep ordinary
    // two-axis wheel gestures for panning so a graph behaves like a canvas,
    // while pinch/Ctrl+wheel zooms around the pointer.
    if (event.ctrlKey || event.metaKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const factor = Math.exp(-deltaY * 0.0015);
      setCamera((current) => zoomGraphCamera(
        current,
        current.scale * factor,
        anchor,
      ));
      return;
    }

    const horizontalDelta = event.shiftKey && Math.abs(deltaX) < Math.abs(deltaY)
      ? deltaY
      : deltaX;
    const verticalDelta = event.shiftKey && Math.abs(deltaX) < Math.abs(deltaY)
      ? 0
      : deltaY;
    setCamera((current) => ({
      ...current,
      x: current.x - horizontalDelta,
      y: current.y - verticalDelta,
    }));
  };

  const activateNode = (node: AstraGraphNode): void => {
    if (node.kind === 'decision-cluster') {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    }
    setSelectedId(node.id);
    onSelectNode?.(node);
    const reference = referenceForNode(node);
    if (reference) onOpenReference?.(reference);
  };

  const onNodeKeyDown = (
    event: KeyboardEvent<SVGGElement>,
    node: AstraGraphNode,
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateNode(node);
    }
  };

  return (
    <section className="astra-graph" aria-label={`${renderedProjection.project.name} provenance graph`}>
      <header className="astra-graph-toolbar">
        <strong>{title ?? renderedProjection.project.name}</strong>
        <code>universe: {renderedProjection.universe.id}</code>
        <span className="astra-graph-help">
          Drag or scroll to pan · pinch or Ctrl+scroll to zoom
        </span>
        <div className="astra-graph-view-controls" aria-label="Graph view controls">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomFromCenter(0.82)}
          >
            −
          </button>
          <button type="button" onClick={resetCamera}>
            {Math.round(camera.scale * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomFromCenter(1.22)}
          >
            +
          </button>
        </div>
        {expanded.size ? (
          <button type="button" onClick={() => setExpanded(new Set())}>
            Collapse decisions
          </button>
        ) : null}
      </header>
      <div
        ref={viewportRef}
        className="astra-graph-viewport"
        data-panning={isPanning}
      >
        <svg
          className="astra-graph-svg"
          width="100%"
          height="100%"
          viewBox={`0 0 ${Math.max(1, viewportSize.width)} ${Math.max(1, viewportSize.height)}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${renderedProjection.project.name} provenance graph`}
          onPointerDown={onGraphPointerDown}
          onPointerMove={onGraphPointerMove}
          onPointerUp={endGraphPan}
          onPointerCancel={endGraphPan}
          onWheel={onGraphWheel}
        >
          <defs>
            {(Object.keys(EDGE_STYLES) as AstraGraphEdgeKind[]).map((kind) => (
              <marker
                key={kind}
                id={`${markerPrefix}-${kind}`}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7 z" fill={EDGE_STYLES[kind].color} />
              </marker>
            ))}
          </defs>
          <g
            className="astra-graph-world"
            transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
          >
            {layout.clusterBoxes.map((box) => (
              <rect
                key={box.id}
                className="astra-graph-cluster-box"
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx="8"
              />
            ))}
            {layout.edges.map((edge) => {
              const source = layout.byId.get(edge.source);
              const target = layout.byId.get(edge.target);
              if (!source || !target) return null;
              const style = EDGE_STYLES[edge.kind];
              const dimmed = Boolean(
                selectedId
                && edge.source !== selectedId
                && edge.target !== selectedId,
              );
              return (
                <path
                  key={edge.id}
                  className="astra-graph-edge"
                  d={edgePath(source, target)}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  markerEnd={`url(#${markerPrefix}-${edge.kind})`}
                  opacity={dimmed ? 0.18 : 0.72}
                  aria-label={edge.label}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const isDecision = node.kind === 'decision'
                || node.kind === 'decision-cluster';
              const isCluster = node.kind === 'decision-cluster';
              const radius = node.kind === 'analysis' || node.kind === 'result'
                ? 7.5
                : 6;
              const suffix = isCluster
                ? expanded.has(node.id) ? ' ▾' : ' ▸'
                : '';
              return (
                <g
                  key={node.id}
                  className={`astra-graph-node${isCluster ? ' is-cluster' : ''}${selectedId === node.id ? ' is-selected' : ''}`}
                  data-node-id={node.id}
                  data-node-kind={node.kind}
                  transform={`translate(${node.x} ${node.y})`}
                  tabIndex={0}
                  role={isCluster ? 'button' : 'img'}
                  aria-label={node.label}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(undefined)}
                  onClick={() => activateNode(node)}
                  onKeyDown={(event) => onNodeKeyDown(event, node)}
                >
                  <circle
                    className="astra-graph-focus"
                    r={radius + 5}
                    fill="none"
                    stroke={NODE_COLORS[node.kind]}
                    strokeWidth="2"
                  />
                  {isDecision ? (
                    <rect
                      x={isCluster ? -6 : -5}
                      y={isCluster ? -6 : -5}
                      width={isCluster ? 12 : 10}
                      height={isCluster ? 12 : 10}
                      fill={isCluster ? NODE_COLORS[node.kind] : 'var(--astra-panel)'}
                      stroke={NODE_COLORS[node.kind]}
                      strokeWidth={isCluster ? 0 : 2}
                      transform="rotate(45)"
                    />
                  ) : (
                    <circle r={radius} fill={NODE_COLORS[node.kind]} />
                  )}
                  {node.kind === 'analysis' ? (
                    <text className="astra-graph-stage-label" x="11" y="-10">
                      Analysis stage
                    </text>
                  ) : null}
                  <text
                    className={isDecision
                      ? 'astra-graph-label astra-graph-decision-label'
                      : 'astra-graph-label'}
                    x="11"
                    y="4"
                  >
                    {shortLabel(node.label)}{suffix}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {showLegend ? (
          <GraphLegend open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />
        ) : null}
        {showInspector ? (
          <GraphInspector
            projection={renderedProjection}
            {...(inspectorNode ? { node: inspectorNode } : {})}
            {...(onOpenReference ? { onOpenReference } : {})}
            {...(onReferenceInChat ? { onReferenceInChat } : {})}
          />
        ) : null}
      </div>
      {renderedProjection.diagnostics.length ? (
        <div className="astra-graph-diagnostics" title={renderedProjection.diagnostics.map((item) => item.message).join('\n')}>
          {renderedProjection.diagnostics.length} graph warning{renderedProjection.diagnostics.length === 1 ? '' : 's'} · {renderedProjection.diagnostics[0]?.message}
        </div>
      ) : null}
    </section>
  );
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
