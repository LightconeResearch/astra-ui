import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  buildProjectGraph,
  type GraphOrganizationStatus,
  type ProjectGraphEdge,
  type ProjectGraphNode,
  type ProjectGraphScope,
  type ProjectRecordView,
  type ProjectViewModelV1,
  type RuntimeOverlayV1,
  type ViewerHost,
} from '@lightcone-research/astra-ui-model';
import { ResultViewer } from './result-viewer.js';
import { kindLabel } from './shared.js';
import {
  IconButton,
  ProjectViewHeader,
  SurfaceHeader,
  type SurfaceKind,
} from './ui.js';

const HORIZONTAL_GAP = 230;
const VERTICAL_GAP = 116;
const RIGHT_GUTTER = 84;
const CANVAS_PADDING_Y = 72;
const NODE_RADIUS = 7;
const DECISION_PANEL_WIDTH = 264;
const DECISION_PANEL_COLLAPSED_WIDTH = 44;
const DECISION_PANEL_HEADER_HEIGHT = 42;
const DECISION_PANEL_ROW_HEIGHT = 38;

type EdgeVisualKind = 'flow' | 'scope' | 'decision' | 'evidence' | 'reference';

interface PositionedNode {
  node: ProjectGraphNode;
  scope?: ProjectGraphScope;
  x: number;
  y: number;
}

interface DisplayGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  decisions: ProjectGraphNode[];
  decisionEdges: ProjectGraphEdge[];
}

interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  nodeById: ReadonlyMap<string, PositionedNode>;
}

interface ActiveNodePopover {
  nodeId: string;
  anchorX: number;
  anchorY: number;
}

function isStructuralGraphNode(node: ProjectGraphNode): boolean {
  return node.kind !== 'prior_insight' && node.kind !== 'finding';
}

function decisionPanelGraph(
  nodes: readonly ProjectGraphNode[],
  edges: readonly ProjectGraphEdge[],
): DisplayGraph {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const decisions = nodes
    .filter((node) => node.kind === 'decision')
    .sort((left, right) => left.label.localeCompare(right.label));
  const visibleNodes = nodes.filter((node) => node.kind !== 'decision');
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => (
    visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId)
  ));
  const decisionEdges = edges.filter((edge) => (
    edge.relationKinds.includes('parameterized_by')
    && nodeById.get(edge.sourceNodeId)?.kind === 'decision'
    && nodeById.get(edge.targetNodeId)?.kind === 'output'
    && visibleNodeIds.has(edge.targetNodeId)
  ));

  return { nodes: visibleNodes, edges: visibleEdges, decisions, decisionEdges };
}

function kindRank(kind: ProjectGraphNode['kind']): number {
  if (kind === 'input' || kind === 'prior_insight') return 0;
  if (kind === 'decision' || kind === 'analysis') return 1;
  if (kind === 'output') return 2;
  return 3;
}

function nodeRanks(
  nodes: readonly ProjectGraphNode[],
  edges: readonly ProjectGraphEdge[],
): ReadonlyMap<string, number> {
  const ranks = new Map(nodes.map((node) => [node.id, kindRank(node.kind)]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, ProjectGraphEdge[]>();
  for (const edge of edges) {
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
    const next = outgoing.get(edge.sourceNodeId) ?? [];
    next.push(edge);
    outgoing.set(edge.sourceNodeId, next);
  }
  const pending = nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  while (pending.length) {
    const source = pending.shift()!;
    for (const edge of outgoing.get(source) ?? []) {
      ranks.set(
        edge.targetNodeId,
        Math.max(ranks.get(edge.targetNodeId) ?? 0, (ranks.get(source) ?? 0) + 1),
      );
      const nextIndegree = (indegree.get(edge.targetNodeId) ?? 1) - 1;
      indegree.set(edge.targetNodeId, nextIndegree);
      if (nextIndegree === 0) pending.push(edge.targetNodeId);
    }
  }
  return ranks;
}

function layoutGraph(
  nodes: readonly ProjectGraphNode[],
  edges: readonly ProjectGraphEdge[],
  scopes: readonly ProjectGraphScope[],
  decisionPanelOpen: boolean,
  decisionCount: number,
): GraphLayout {
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]));
  const ranks = nodeRanks(nodes, edges);
  const layers = new Map<number, ProjectGraphNode[]>();
  for (const node of nodes) {
    const rank = ranks.get(node.id) ?? kindRank(node.kind);
    const layer = layers.get(rank) ?? [];
    layer.push(node);
    layers.set(rank, layer);
  }
  const layerEntries = [...layers.entries()].sort(([left], [right]) => left - right);
  for (const [, layer] of layerEntries) {
    layer.sort((left, right) => {
      const leftScope = scopeById.get(left.scopeId);
      const rightScope = scopeById.get(right.scopeId);
      return (leftScope?.depth ?? 0) - (rightScope?.depth ?? 0)
        || (leftScope?.canonicalPath ?? '').localeCompare(rightScope?.canonicalPath ?? '')
        || left.kind.localeCompare(right.kind)
        || left.label.localeCompare(right.label);
    });
  }

  const maxLayerSize = Math.max(1, ...layerEntries.map(([, layer]) => layer.length));
  const graphSpan = Math.max(0, maxLayerSize - 1) * HORIZONTAL_GAP;
  const leftGutter = decisionCount
    ? decisionPanelOpen ? DECISION_PANEL_WIDTH + 80 : DECISION_PANEL_COLLAPSED_WIDTH + 60
    : 84;
  const width = Math.max(960, leftGutter + graphSpan + RIGHT_GUTTER + 180);
  const positions: PositionedNode[] = [];
  for (const [rank, layer] of layerEntries) {
    const span = Math.max(0, layer.length - 1) * HORIZONTAL_GAP;
    const available = width - leftGutter - RIGHT_GUTTER;
    const start = leftGutter + (available - span) / 2;
    layer.forEach((node, index) => {
      const scope = scopeById.get(node.scopeId);
      positions.push({
        node,
        ...(scope ? { scope } : {}),
        x: start + index * HORIZONTAL_GAP,
        y: CANVAS_PADDING_Y + rank * VERTICAL_GAP,
      });
    });
  }
  const maxRank = Math.max(0, ...layerEntries.map(([rank]) => rank));
  const nodeById = new Map(positions.map((positioned) => [positioned.node.id, positioned]));
  return {
    width,
    height: Math.max(
      520,
      CANVAS_PADDING_Y * 2 + maxRank * VERTICAL_GAP + 72,
      ...positions.map((positioned) => positioned.y + 72),
    ),
    nodes: positions,
    nodeById,
  };
}

function statusCopy(status: GraphOrganizationStatus): string | undefined {
  if (status === 'stale_valid') {
    return 'The saved organization predates the current ASTRA analysis. Valid groups remain applied; new records stay exposed.';
  }
  if (status === 'stale_partly_invalid') {
    return 'Some saved groups no longer match the ASTRA analysis. Invalid groups have been expanded so no records disappear.';
  }
  return undefined;
}

function shortLabel(label: string, max = 38): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function edgeVisualKind(edge: ProjectGraphEdge): EdgeVisualKind {
  if (edge.projectionRole === 'subanalysis_input') return 'flow';
  if (edge.relationKinds.includes('contains')) return 'scope';
  if (edge.relationKinds.includes('depends_on')) return 'flow';
  if (edge.relationKinds.includes('parameterized_by')) return 'decision';
  if (
    edge.relationKinds.includes('informed_by')
    || edge.relationKinds.includes('evidenced_by')
  ) return 'evidence';
  if (
    edge.relationKinds.includes('aliases')
    || edge.relationKinds.includes('derived_from')
  ) return 'reference';
  return 'flow';
}

function decisionTracePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const direction = sourceX <= targetX ? 1 : -1;
  const targetEdgeX = targetX - direction * NODE_RADIUS;
  const bend = Math.max(52, Math.min(160, Math.abs(targetEdgeX - sourceX) * 0.34));
  return `M ${sourceX} ${sourceY} C ${sourceX + direction * bend} ${sourceY}, ${targetEdgeX - direction * bend} ${targetY}, ${targetEdgeX} ${targetY}`;
}

function edgePath(
  source: PositionedNode,
  target: PositionedNode,
  visualKind: EdgeVisualKind,
): string {
  if (visualKind === 'decision') {
    const direction = source.x <= target.x ? 1 : -1;
    const sourceX = source.x + direction * NODE_RADIUS;
    const targetX = target.x - direction * NODE_RADIUS;
    const bend = Math.max(52, Math.min(160, Math.abs(targetX - sourceX) * 0.34));
    return `M ${sourceX} ${source.y} C ${sourceX + direction * bend} ${source.y}, ${targetX - direction * bend} ${target.y}, ${targetX} ${target.y}`;
  }
  if (Math.abs(source.y - target.y) < 36) {
    const direction = source.x <= target.x ? 1 : -1;
    return `M ${source.x + direction * NODE_RADIUS} ${source.y} L ${target.x - direction * NODE_RADIUS} ${target.y}`;
  }
  const downward = target.y >= source.y;
  const y1 = source.y + (downward ? NODE_RADIUS : -NODE_RADIUS);
  const y2 = target.y - (downward ? NODE_RADIUS : -NODE_RADIUS);
  const middle = y1 + (y2 - y1) * 0.52;
  return `M ${source.x} ${y1} C ${source.x} ${middle}, ${target.x} ${middle}, ${target.x} ${y2}`;
}

function nodeDetail(positioned: PositionedNode): string | undefined {
  const { node, scope } = positioned;
  if (node.nodeType === 'scope') {
    return `Sub-analysis · ${node.recordCount} records · click to inspect`;
  }
  if (node.kind === 'output' && scope?.depth) {
    return `From ${scope.name}`;
  }
  return undefined;
}

function GraphNodeGlyph({
  positioned,
  recordsById,
  onInspect,
}: {
  positioned: PositionedNode;
  recordsById: ReadonlyMap<string, ProjectRecordView>;
  onInspect: (node: ProjectGraphNode, x: number, y: number) => void;
}) {
  const { node, x, y } = positioned;
  const record = node.nodeType === 'record' ? recordsById.get(node.recordId) : undefined;
  const activate = () => onInspect(node, x, y);
  const title = node.nodeType === 'scope'
    ? `${node.label} ASTRA sub-analysis; click to inspect`
    : node.nodeType === 'group'
    ? `${node.label}: ${node.memberRecordIds.length} grouped records`
    : `${record?.label ?? node.label}: ${node.canonicalPath}`;
  return (
    <g
      className="astra-graph-node"
      data-kind={node.kind}
      data-node-type={node.nodeType}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }}
    >
      <title>{title}</title>
      <circle className="astra-graph-node__focus" r="13" />
      {node.nodeType === 'scope' ? (
        <rect
          className="astra-graph-node__mark"
          x="-7"
          y="-6"
          width="14"
          height="12"
          rx="3"
        />
      ) : node.kind === 'decision' ? (
        <rect
          className="astra-graph-node__mark"
          x="-5.5"
          y="-5.5"
          width="11"
          height="11"
          transform="rotate(45)"
        />
      ) : node.nodeType === 'group' ? (
        <g className="astra-graph-node__group-mark" aria-hidden="true">
          <circle className="astra-graph-node__mark astra-graph-node__mark--group-back" cx="-3" cy="-3" r="5" />
          <circle className="astra-graph-node__mark astra-graph-node__mark--group-front" cx="2" cy="2" r="5" />
        </g>
      ) : (
        <circle className="astra-graph-node__mark" r={NODE_RADIUS} />
      )}
      {node.nodeType === 'scope' ? (
        <text className="astra-graph-node__scope" x="12" y="-11">
          Sub-analysis
        </text>
      ) : null}
      <text className="astra-graph-node__label" x="12" y="4">
        {shortLabel(node.label)}
      </text>
      {nodeDetail(positioned) ? (
        <text className="astra-graph-node__detail" x="12" y="20">
          {nodeDetail(positioned)}
        </text>
      ) : null}
    </g>
  );
}

function PopoverDismiss({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      type="button"
      className="astra-graph__popover-dismiss"
      aria-label={label}
      onClick={onClose}
    />
  );
}

function PopoverHeader({
  eyebrow,
  title,
  titleId,
  kind,
  openLabel,
  onOpen,
  onClose,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  kind?: SurfaceKind;
  openLabel?: string;
  onOpen?: () => void;
  onClose: () => void;
}) {
  return (
    <SurfaceHeader
      className="astra-graph__group-popover-header"
      actionsClassName="astra-graph__popover-actions"
      density="compact"
      kind={kind}
      eyebrow={eyebrow}
      title={title}
      titleId={titleId}
      titleAs="h2"
      actions={(
        <>
          {openLabel && onOpen ? (
            <IconButton
              className="astra-graph__popover-open"
              variant="quiet"
              size="small"
              tone="accent"
              label={openLabel}
              title={openLabel}
              onClick={onOpen}
            >
              ↗
            </IconButton>
          ) : null}
          <IconButton
            variant="quiet"
            size="small"
            label="Close preview"
            onClick={onClose}
          >
            ×
          </IconButton>
        </>
      )}
    />
  );
}

function recordMetadata(record: ProjectRecordView): string | undefined {
  if (record.kind === 'decision') {
    const selected = record.options.find((option) => option.selected);
    const value = selected?.label ?? selected?.id ?? record.selectedOptionId;
    return value ? `Selected: ${value}` : undefined;
  }
  if (record.kind === 'output') return record.outputType;
  if (record.kind === 'input') return record.inputType;
  return undefined;
}

function RecordPopover({
  record,
  label,
  titleId,
  anchorX,
  anchorY,
  model,
  runtime,
  host,
  onOpenRecord,
  onClose,
}: {
  record: ProjectRecordView;
  label?: string;
  titleId: string;
  anchorX: number;
  anchorY: number;
  model: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  onOpenRecord?: (record: ProjectRecordView) => void;
  onClose: () => void;
}) {
  const title = label ?? record.label ?? record.localId;
  const description = record.description
    ?? (record.kind === 'decision' ? record.rationale : undefined);
  const metadata = recordMetadata(record);
  const showArtifactPreview = record.kind === 'output'
    && (record.outputType === 'figure' || record.outputType === 'table');
  return (
    <>
      <PopoverDismiss label="Dismiss record preview" onClose={onClose} />
      <aside
        className="astra-graph__group-popover astra-graph__record-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          left: `clamp(12px, ${anchorX}px, calc(100% - 300px))`,
          top: `clamp(12px, ${anchorY}px, calc(100% - 300px))`,
        }}
      >
        <PopoverHeader
          eyebrow={kindLabel(record.kind)}
          title={title}
          titleId={titleId}
          kind={record.kind}
          {...(onOpenRecord ? {
            openLabel: `Open full details: ${title}`,
            onOpen: () => {
              onClose();
              onOpenRecord(record);
            },
          } : {})}
          onClose={onClose}
        />
        <div className="astra-graph__popover-body">
          {metadata ? <strong>{metadata}</strong> : null}
          {showArtifactPreview ? (
            <div className="astra-graph__record-preview">
              <ResultViewer
                output={record}
                model={model}
                {...(runtime ? { runtime } : {})}
                {...(host ? { host } : {})}
              />
            </div>
          ) : null}
          {description ? <p>{description}</p> : null}
          <code>{record.canonicalPath}</code>
        </div>
      </aside>
    </>
  );
}

function ScopePopover({
  node,
  scope,
  titleId,
  anchorX,
  anchorY,
  onEnterScope,
  onOpenScope,
  onClose,
}: {
  node: Extract<ProjectGraphNode, { nodeType: 'scope' }>;
  scope?: ProjectGraphScope;
  titleId: string;
  anchorX: number;
  anchorY: number;
  onEnterScope: (scopeId: string) => void;
  onOpenScope?: (scope: ProjectGraphScope) => void;
  onClose: () => void;
}) {
  return (
    <>
      <PopoverDismiss label="Dismiss sub-analysis preview" onClose={onClose} />
      <aside
        className="astra-graph__group-popover astra-graph__record-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          left: `clamp(12px, ${anchorX}px, calc(100% - 300px))`,
          top: `clamp(12px, ${anchorY}px, calc(100% - 280px))`,
        }}
      >
        <PopoverHeader
          eyebrow={`${node.recordCount} records`}
          title={node.label}
          titleId={titleId}
          kind="analysis"
          {...(scope && onOpenScope ? {
            openLabel: `Open full analysis view: ${node.label}`,
            onOpen: () => {
              onClose();
              onOpenScope(scope);
            },
          } : {})}
          onClose={onClose}
        />
        <div className="astra-graph__popover-body">
          {node.description ? <p>{node.description}</p> : null}
          <code>{node.canonicalPath}</code>
          <button
            type="button"
            className="astra-graph__popover-enter"
            onClick={() => {
              onClose();
              onEnterScope(node.targetScopeId);
            }}
          >
            View sub-analysis graph
          </button>
        </div>
      </aside>
    </>
  );
}

function GroupPopover({
  group,
  recordsById,
  titleId,
  anchorX,
  anchorY,
  onOpenRecord,
  onClose,
}: {
  group: ProjectGraphNode;
  recordsById: ReadonlyMap<string, ProjectRecordView>;
  titleId: string;
  anchorX: number;
  anchorY: number;
  onOpenRecord?: (record: ProjectRecordView) => void;
  onClose: () => void;
}) {
  if (group.nodeType !== 'group') return null;
  const records = group.memberRecordIds
    .map((recordId) => recordsById.get(recordId))
    .filter((record): record is ProjectRecordView => Boolean(record));
  return (
    <>
      <PopoverDismiss label="Dismiss grouped records" onClose={onClose} />
      <aside
        className="astra-graph__group-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          left: `clamp(12px, ${anchorX}px, calc(100% - 300px))`,
          top: `clamp(12px, ${anchorY}px, calc(100% - 420px))`,
        }}
      >
        <PopoverHeader
          eyebrow={`${records.length} ${kindLabel(group.kind).toLowerCase()} records`}
          title={group.label}
          titleId={titleId}
          kind={group.kind}
          onClose={onClose}
        />
        <div className="astra-graph__group-members">
          {records.map((record) => {
            const label = record.label ?? record.localId;
            return onOpenRecord ? (
              <button
                type="button"
                className="astra-graph__group-member"
                key={record.id}
                onClick={() => {
                  onClose();
                  onOpenRecord(record);
                }}
              >
                <span className="astra-graph__group-member-icon" data-kind={record.kind} />
                <span>
                  <strong>{label}</strong>
                  <small>{record.canonicalPath}</small>
                </span>
                <span className="astra-graph__group-member-open" aria-hidden="true">↗</span>
              </button>
            ) : (
              <div className="astra-graph__group-member" key={record.id}>
                <span className="astra-graph__group-member-icon" data-kind={record.kind} />
                <span>
                  <strong>{label}</strong>
                  <small>{record.canonicalPath}</small>
                </span>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function decisionSelectionLabel(
  node: ProjectGraphNode,
  recordsById: ReadonlyMap<string, ProjectRecordView>,
): string | undefined {
  if (node.nodeType === 'group') {
    return `${node.memberRecordIds.length} grouped decisions`;
  }
  if (node.nodeType !== 'record') return undefined;
  const record = recordsById.get(node.recordId);
  if (!record || record.kind !== 'decision') return undefined;
  const selected = record.options.find((option) => option.selected);
  return selected?.label ?? selected?.id ?? record.selectedOptionId;
}

function DecisionPanel({
  decisions,
  recordsById,
  open,
  selectedDecisionNodeId,
  onToggle,
  onSelect,
  onListScroll,
}: {
  decisions: readonly ProjectGraphNode[];
  recordsById: ReadonlyMap<string, ProjectRecordView>;
  open: boolean;
  selectedDecisionNodeId?: string;
  onToggle: () => void;
  onSelect: (
    node: ProjectGraphNode | undefined,
    anchorX: number,
    anchorY: number,
  ) => void;
  onListScroll: (scrollTop: number) => void;
}) {
  if (!decisions.length) return null;
  return (
    <aside
      className="astra-graph__decision-panel"
      aria-label="Analysis decisions"
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="astra-graph__decision-panel-toggle"
        aria-expanded={open}
        aria-label={open ? 'Collapse decisions' : 'Expand decisions'}
        onClick={onToggle}
      >
        <span>Decisions</span>
        <strong>{decisions.length}</strong>
        <small aria-hidden="true">{open ? '‹' : '›'}</small>
      </button>
      {open ? (
        <div
          className="astra-graph__decision-list"
          onScroll={(event) => onListScroll(event.currentTarget.scrollTop)}
        >
          {decisions.map((decision) => {
            const selected = decision.id === selectedDecisionNodeId;
            const selection = decisionSelectionLabel(decision, recordsById);
            return (
              <button
                type="button"
                key={decision.id}
                className="astra-graph__decision-row"
                data-selected={selected ? 'true' : 'false'}
                aria-pressed={selected}
                title={`${decision.label}${selection ? ` — ${selection}` : ''}`}
                onClick={(event) => {
                  const viewport = event.currentTarget.closest('.astra-graph__viewport');
                  const viewportTop = viewport?.getBoundingClientRect().top ?? 0;
                  const anchorY = event.currentTarget.getBoundingClientRect().top
                    - viewportTop
                    + 6;
                  onSelect(
                    selected ? undefined : decision,
                    DECISION_PANEL_WIDTH + 12,
                    anchorY,
                  );
                }}
              >
                <span>{decision.label}</span>
                {selection ? <small>{selection}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}

function GraphLegend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="astra-graph__legend">
      <button
        type="button"
        className="astra-graph__button astra-graph__legend-toggle"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
      >
        <span>Graph grammar</span>
        <small aria-hidden="true">{open ? '▴' : '▾'}</small>
      </button>
      {open ? (
        <aside className="astra-graph__legend-menu" aria-label="Graph grammar">
          <div className="astra-graph__legend-body">
            <div className="astra-graph__legend-section">Records</div>
            {([
              ['analysis', 'Sub-analysis'],
              ['input', 'Input'],
              ['decision', 'Decision'],
              ['output', 'Output'],
            ] as const).map(([kind, label]) => (
              <div className="astra-graph__legend-row" key={kind}>
                <span className="astra-graph__legend-node" data-kind={kind} />
                <span>{label}</span>
              </div>
            ))}
            <div className="astra-graph__legend-row">
              <span className="astra-graph__legend-node" data-kind="decision-panel" />
              <span>Decision list</span>
            </div>
            <div className="astra-graph__legend-row">
              <span className="astra-graph__legend-node" data-kind="group" />
              <span>Presentation group</span>
            </div>
            <div className="astra-graph__legend-section">Canonical relations</div>
            {([
              ['flow', 'data / artifact flow'],
              ['scope', 'sub-analysis output'],
              ['decision', 'selected decision → direct outputs'],
              ['reference', 'alias / derived reference'],
            ] as const).map(([kind, label]) => (
              <div className="astra-graph__legend-row" key={kind}>
                <svg
                  className="astra-graph__legend-line"
                  data-edge-kind={kind}
                  viewBox="0 0 24 8"
                  aria-hidden="true"
                >
                  <path className="astra-graph__legend-line-path" d="M 1 4 L 20 4" />
                  <path className="astra-graph__legend-line-arrow" d="M 18 1 L 23 4 L 18 7 Z" />
                </svg>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export interface GraphExplorerProps {
  model: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  organization?: unknown;
  onOpenRecord?: (record: ProjectRecordView) => void;
  onOpenScope?: (scope: ProjectGraphScope) => void;
  onOrganize?: () => void | Promise<void>;
}

/** Portable, lossless ASTRA graph with optional validated presentation groups. */
export function GraphExplorer({
  model,
  runtime,
  host,
  organization,
  onOpenRecord,
  onOpenScope,
  onOrganize,
}: GraphExplorerProps) {
  const markerBase = useId().replaceAll(':', '');
  const hasOrganization = organization !== undefined && organization !== null;
  const rootScopeId = model.scopes.find((scope) => !scope.parentId)?.id
    ?? model.scopes[0]?.id
    ?? 'root';
  const [choiceDismissed, setChoiceDismissed] = useState(hasOrganization);
  const [useOrganization, setUseOrganization] = useState(true);
  const [focusedScopeId, setFocusedScopeId] = useState(rootScopeId);
  const [activeNodePopover, setActiveNodePopover] = useState<ActiveNodePopover>();
  const [decisionPanelOpen, setDecisionPanelOpen] = useState(false);
  const [selectedDecisionNodeId, setSelectedDecisionNodeId] = useState<string>();
  const [decisionListScrollTop, setDecisionListScrollTop] = useState(0);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
  const [panning, setPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [legendOpen, setLegendOpen] = useState(false);
  const [organizeError, setOrganizeError] = useState<string>();
  const [organizing, setOrganizing] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragPanRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  }>();
  const suppressPanClickRef = useRef(false);

  useEffect(() => {
    if (hasOrganization) {
      setChoiceDismissed(true);
      setUseOrganization(true);
    }
  }, [hasOrganization]);

  useEffect(() => {
    if (!model.scopes.some((scope) => scope.id === focusedScopeId)) {
      setFocusedScopeId(rootScopeId);
    }
  }, [focusedScopeId, model.scopes, rootScopeId]);

  const graph = useMemo(
    () => buildProjectGraph(model, organization, {
      useOrganization,
      focusScopeId: focusedScopeId,
    }),
    [focusedScopeId, model, organization, useOrganization],
  );
  const structuralGraph = useMemo(() => {
    const nodes = graph.nodes.filter(isStructuralGraphNode);
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
      nodes,
      edges: graph.edges.filter((edge) => (
        nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
      )),
    };
  }, [graph.edges, graph.nodes]);
  const displayGraph = useMemo(
    () => decisionPanelGraph(structuralGraph.nodes, structuralGraph.edges),
    [structuralGraph.edges, structuralGraph.nodes],
  );
  const layout = useMemo(
    () => layoutGraph(
      displayGraph.nodes,
      displayGraph.edges,
      graph.scopes,
      decisionPanelOpen,
      displayGraph.decisions.length,
    ),
    [decisionPanelOpen, displayGraph.decisions.length, displayGraph.edges, displayGraph.nodes, graph.scopes],
  );
  const recordsById = useMemo(
    () => new Map(model.records.map((record) => [record.id, record])),
    [model.records],
  );
  const activePopoverNode = activeNodePopover
    ? [...displayGraph.nodes, ...displayGraph.decisions]
      .find((node) => node.id === activeNodePopover.nodeId)
    : undefined;
  const activePopoverRecord = activePopoverNode?.nodeType === 'record'
    ? recordsById.get(activePopoverNode.recordId)
    : undefined;
  const activePopoverScope = activePopoverNode?.nodeType === 'scope'
    ? graph.scopes.find((scope) => scope.id === activePopoverNode.targetScopeId)
    : undefined;
  const selectedDecisionIndex = displayGraph.decisions.findIndex(
    (decision) => decision.id === selectedDecisionNodeId,
  );
  const selectedDecision = selectedDecisionIndex >= 0
    ? displayGraph.decisions[selectedDecisionIndex]
    : undefined;
  const selectedDecisionSourceY = selectedDecision
    ? DECISION_PANEL_HEADER_HEIGHT
      + selectedDecisionIndex * DECISION_PANEL_ROW_HEIGHT
      + DECISION_PANEL_ROW_HEIGHT / 2
      - decisionListScrollTop
    : undefined;
  const warning = statusCopy(graph.organizationStatus);
  const focusedScope = model.scopes.find((scope) => scope.id === graph.focusScopeId);
  const parentScope = focusedScope?.parentId
    ? model.scopes.find((scope) => scope.id === focusedScope.parentId)
    : undefined;

  useEffect(() => {
    if (
      selectedDecisionNodeId
      && !displayGraph.decisions.some((decision) => decision.id === selectedDecisionNodeId)
    ) {
      setSelectedDecisionNodeId(undefined);
    }
  }, [displayGraph.decisions, selectedDecisionNodeId]);

  useEffect(() => {
    if (activeNodePopover && !activePopoverNode) setActiveNodePopover(undefined);
  }, [activeNodePopover, activePopoverNode]);

  useEffect(() => {
    if (!choiceDismissed || !viewportRef.current) return;
    const viewport = viewportRef.current;
    const frame = requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      setScrollPosition({ left: 0, top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [choiceDismissed, focusedScopeId, useOrganization]);

  const organize = async () => {
    if (!onOrganize || organizing) return;
    setChoiceDismissed(true);
    setOrganizeError(undefined);
    setOrganizing(true);
    try {
      await onOrganize();
    } catch (error) {
      setOrganizeError(error instanceof Error ? error.message : 'Could not open the AI assistant.');
    } finally {
      setOrganizing(false);
    }
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
    dragPanRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    event.preventDefault();
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragPanRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.originX;
    const deltaY = event.clientY - drag.originY;
    if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;
    event.currentTarget.scrollLeft = drag.scrollLeft - deltaX;
    event.currentTarget.scrollTop = drag.scrollTop - deltaY;
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragPanRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressPanClickRef.current = drag.moved;
    if (drag.moved) {
      window.setTimeout(() => {
        suppressPanClickRef.current = false;
      }, 0);
    }
    dragPanRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPanning(false);
  };
  const suppressDraggedClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressPanClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressPanClickRef.current = false;
  };
  const enterScope = (scopeId: string) => {
    setFocusedScopeId(scopeId);
    setActiveNodePopover(undefined);
    setDecisionPanelOpen(false);
    setSelectedDecisionNodeId(undefined);
    setDecisionListScrollTop(0);
    setZoom(1);
    setChoiceDismissed(true);
  };

  return (
    <section className="astra-graph" aria-label="ASTRA analysis graph">
      <ProjectViewHeader
        className="astra-graph__toolbar"
        summaryClassName="astra-graph__summary"
        actionsClassName="astra-graph__actions"
        title={focusedScope?.name ?? model.project.name}
        titleAs="h1"
        context={model.selection.universeId
          ? `universe: ${model.selection.universeId}`
          : undefined}
        leading={parentScope ? (
          <button
            type="button"
            className="astra-graph__scope-back"
            onClick={() => enterScope(parentScope.id)}
          >
            {`← ${parentScope.name}`}
          </button>
        ) : null}
        actions={(
          <>
            {hasOrganization ? (
              <button
                type="button"
                className="astra-graph__button"
                onClick={() => {
                  setUseOrganization((value) => !value);
                  setActiveNodePopover(undefined);
                  setSelectedDecisionNodeId(undefined);
                }}
              >
                {useOrganization ? 'View ungrouped graph' : 'View organized graph'}
              </button>
            ) : null}
            {onOrganize ? (
              <button
                type="button"
                className="astra-graph__button"
                onClick={() => void organize()}
                disabled={organizing}
              >
                {hasOrganization ? 'Refresh with AI' : 'Organize with AI'}
              </button>
            ) : null}
            <div className="astra-graph__zoom" aria-label="Graph zoom">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.65, value - 0.1))}
              >−</button>
              <button type="button" onClick={() => setZoom(1)}>{`${Math.round(zoom * 100)}%`}</button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}
              >+</button>
            </div>
            <GraphLegend open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />
          </>
        )}
      />

      {warning ? <div className="astra-graph__warning" role="status">{warning}</div> : null}
      {organizeError ? <div className="astra-graph__warning" role="alert">{organizeError}</div> : null}

      <div className={`astra-graph__viewport${!choiceDismissed ? ' is-awaiting-choice' : ''}`}>
        <div
          ref={viewportRef}
          className={`astra-graph__scrollplane${panning ? ' is-panning' : ''}`}
          aria-label="Graph canvas; drag to pan"
          onScroll={(event) => setScrollPosition({
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          })}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onClickCapture={suppressDraggedClick}
        >
          <svg
            className="astra-graph__canvas"
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label={`Graph of ${model.project.name}`}
          >
            <defs>
              {(['flow', 'scope', 'decision', 'evidence', 'reference'] as const).map((kind) => (
                <marker
                  key={kind}
                  id={`${markerBase}-arrow-${kind}`}
                  viewBox="0 0 7 7"
                  refX="6"
                  refY="3.5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path className="astra-graph-edge__arrow" data-edge-kind={kind} d="M 0 0 L 7 3.5 L 0 7 z" />
                </marker>
              ))}
            </defs>
            <g className="astra-graph__edges">
              {displayGraph.edges.map((edge) => {
                const source = layout.nodeById.get(edge.sourceNodeId);
                const target = layout.nodeById.get(edge.targetNodeId);
                if (!source || !target) return null;
                const visualKind = edgeVisualKind(edge);
                return (
                  <path
                    key={edge.id}
                    className="astra-graph-edge"
                    data-edge-kind={visualKind}
                    data-edge-active="true"
                    d={edgePath(source, target, visualKind)}
                    markerEnd={`url(#${markerBase}-arrow-${visualKind})`}
                  >
                    <title>{edge.relationKinds.join(', ')}</title>
                  </path>
                );
              })}
            </g>
            {layout.nodes.map((positioned) => (
              <GraphNodeGlyph
                key={positioned.node.id}
                positioned={positioned}
                recordsById={recordsById}
                onInspect={(node, x, y) => setActiveNodePopover({
                  nodeId: node.id,
                  anchorX: x * zoom - scrollPosition.left + 18,
                  anchorY: y * zoom - scrollPosition.top + 18,
                })}
              />
            ))}
          </svg>
        </div>

        {decisionPanelOpen && selectedDecision && selectedDecisionSourceY !== undefined ? (
          <svg className="astra-graph__decision-links" aria-hidden="true">
            <defs>
              <marker
                id={`${markerBase}-arrow-decision-overlay`}
                viewBox="0 0 7 7"
                refX="6"
                refY="3.5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path className="astra-graph-edge__arrow" data-edge-kind="decision" d="M 0 0 L 7 3.5 L 0 7 z" />
              </marker>
            </defs>
            {displayGraph.decisionEdges
              .filter((edge) => edge.sourceNodeId === selectedDecision.id)
              .map((edge) => {
                const target = layout.nodeById.get(edge.targetNodeId);
                if (!target) return null;
                return (
                  <path
                    key={`selected-${edge.id}`}
                    className="astra-graph-edge"
                    data-edge-kind="decision"
                    data-edge-active="true"
                    d={decisionTracePath(
                      DECISION_PANEL_WIDTH,
                      selectedDecisionSourceY,
                      target.x * zoom - scrollPosition.left,
                      target.y * zoom - scrollPosition.top,
                    )}
                    markerEnd={`url(#${markerBase}-arrow-decision-overlay)`}
                  >
                    <title>{edge.relationKinds.join(', ')}</title>
                  </path>
                );
              })}
          </svg>
        ) : null}
        <DecisionPanel
          decisions={displayGraph.decisions}
          recordsById={recordsById}
          open={decisionPanelOpen}
          {...(selectedDecisionNodeId ? { selectedDecisionNodeId } : {})}
          onToggle={() => {
            if (decisionPanelOpen) {
              setSelectedDecisionNodeId(undefined);
              setDecisionListScrollTop(0);
              if (activePopoverNode?.kind === 'decision') {
                setActiveNodePopover(undefined);
              }
            }
            setDecisionPanelOpen(!decisionPanelOpen);
          }}
          onSelect={(node, anchorX, anchorY) => {
            setSelectedDecisionNodeId(node?.id);
            setActiveNodePopover(node ? {
              nodeId: node.id,
              anchorX,
              anchorY,
            } : undefined);
          }}
          onListScroll={(scrollTop) => {
            setDecisionListScrollTop(scrollTop);
            if (activePopoverNode?.kind === 'decision') {
              setActiveNodePopover(undefined);
            }
          }}
        />
        {activeNodePopover && activePopoverNode?.nodeType === 'group' ? (
          <GroupPopover
            group={activePopoverNode}
            recordsById={recordsById}
            titleId={`${markerBase}-group-popover-title`}
            anchorX={activeNodePopover.anchorX}
            anchorY={activeNodePopover.anchorY}
            {...(onOpenRecord ? { onOpenRecord } : {})}
            onClose={() => setActiveNodePopover(undefined)}
          />
        ) : null}
        {activeNodePopover && activePopoverRecord ? (
          <RecordPopover
            record={activePopoverRecord}
            {...(activePopoverNode?.label ? { label: activePopoverNode.label } : {})}
            titleId={`${markerBase}-record-popover-title`}
            anchorX={activeNodePopover.anchorX}
            anchorY={activeNodePopover.anchorY}
            model={model}
            {...(runtime ? { runtime } : {})}
            {...(host ? { host } : {})}
            {...(onOpenRecord ? { onOpenRecord } : {})}
            onClose={() => setActiveNodePopover(undefined)}
          />
        ) : null}
        {activeNodePopover && activePopoverNode?.nodeType === 'scope' ? (
          <ScopePopover
            node={activePopoverNode}
            {...(activePopoverScope ? { scope: activePopoverScope } : {})}
            titleId={`${markerBase}-scope-popover-title`}
            anchorX={activeNodePopover.anchorX}
            anchorY={activeNodePopover.anchorY}
            onEnterScope={enterScope}
            {...(onOpenScope ? { onOpenScope } : {})}
            onClose={() => setActiveNodePopover(undefined)}
          />
        ) : null}
        {!choiceDismissed ? (
          <div className="astra-graph-choice" role="dialog" aria-labelledby="astra-graph-choice-title">
            <span className="astra-graph-choice__eyebrow">Structural ASTRA graph</span>
            <h2 id="astra-graph-choice-title">How would you like to begin?</h2>
            <p>Inputs, decisions, outputs, and real sub-analyses remain mechanically derived from ASTRA. Prior insights and findings stay in inventory/detail views.</p>
            <div className="astra-graph-choice__actions">
              {onOrganize ? (
                <button
                  type="button"
                  className="astra-graph-choice__primary"
                  onClick={() => void organize()}
                  disabled={organizing}
                >
                  Organize graph with AI
                </button>
              ) : null}
              <button
                type="button"
                className="astra-graph-choice__secondary"
                onClick={() => {
                  setUseOrganization(false);
                  setChoiceDismissed(true);
                }}
              >
                View ungrouped graph
              </button>
            </div>
            <small>You can switch views at any time.</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
