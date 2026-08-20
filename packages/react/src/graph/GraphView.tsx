/**
 * The graph view: a React Flow render of the mechanical scope graph. The
 * component owns presentation only — every node, edge, and position comes
 * from the pure derivation and layout modules, so what it draws is always
 * exactly the canonical model. Pair with the `graph.css` entry.
 */
import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from '@xyflow/react';
import type {
  Edge,
  Node,
  NodeMouseHandler,
  NodeProps,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { InventoryModel } from '../full-inventory/model.js';
import type { InventoryKind, InventoryRecord, InventoryScope } from '../types.js';
import { deriveProjectGraph } from './model.js';
import type {
  GraphDerivation,
  GraphEdge,
  GraphNode,
  GraphOrganization,
} from './model.js';
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  layoutProjectGraph,
} from './layout.js';

export interface GraphViewProps {
  model: InventoryModel;
  /** Scope to project; defaults to the root scope. */
  scopeId?: string;
  /**
   * Optional presentation overlay. When present, member nodes cluster under
   * their group labels; unknown members are silently ignored and everything
   * ungrouped keeps its mechanical position. Hosts wanting a quiet coverage
   * note can call `deriveProjectGraph` for `unorganizedCount`.
   */
  organization?: GraphOrganization;
  /**
   * Quiet, host-supplied pointer to the authoring-time organizer (for
   * example "run /organize-graph"), shown only while no organization is
   * applied. Workbench hosts pass one; publications pass nothing.
   */
  organizeHint?: ReactNode;
  onOpenRecord?: (record: InventoryRecord, scope: InventoryScope) => void;
  onOpenScope?: (scope: InventoryScope) => void;
  className?: string;
}

const KIND_GLYPHS: Record<InventoryKind, string> = {
  analysis: '◐',
  input: '↳',
  decision: '◇',
  output: '◆',
  finding: '●',
  prior_insight: '◈',
};

const KIND_LABELS: Record<InventoryKind, string> = {
  analysis: 'Sub-analysis',
  input: 'Input',
  decision: 'Decision',
  output: 'Output',
  finding: 'Finding',
  prior_insight: 'Prior insight',
};

type EdgeFamily = 'flow' | 'decision' | 'evidence' | 'reference';

interface FlowNodeData extends Record<string, unknown> {
  graphNode: GraphNode;
  kicker: string;
  title: string;
}

interface GroupFrameData extends Record<string, unknown> {
  label: string;
  onCollapse?: (label: string) => void;
}

type ChipFlowNode = Node<FlowNodeData, 'astra'>;
type GroupFlowNode = Node<GroupFrameData, 'astra-group'>;
type FlowNode = ChipFlowNode | GroupFlowNode;
type FlowEdge = Edge<Record<string, unknown>>;

function edgeFamily(edge: GraphEdge): EdgeFamily {
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

function nodeKicker(node: GraphNode): string {
  if (node.nodeType === 'scope') {
    const count = node.recordCount === 1 ? '1 record' : `${node.recordCount} records`;
    return `${KIND_LABELS.analysis} · ${count}`;
  }
  if (node.nodeType === 'group') {
    const count = node.memberRecords.length === 1
      ? '1 record'
      : `${node.memberRecords.length} records`;
    return `Group · ${count}`;
  }
  return KIND_LABELS[node.kind];
}

function nodeTitle(node: GraphNode): string {
  if (node.nodeType === 'scope') {
    return `${node.label}: sub-analysis with ${node.recordCount} records`;
  }
  if (node.nodeType === 'group') {
    return `${node.label}: group of ${node.memberRecords.length} records — click to expand`;
  }
  return `${node.label}: ${node.record.canonicalPath}`;
}

function GraphNodeChip({ data }: NodeProps<ChipFlowNode>) {
  const node = data.graphNode;
  return (
    <>
      <Handle
        className="astra-graph-node__handle"
        type="target"
        position={Position.Top}
        isConnectable={false}
      />
      <button
        type="button"
        className="astra-graph-node nodrag"
        data-kind={node.kind}
        data-node-type={node.nodeType}
        aria-label={data.title}
        title={data.title}
      >
        <span className="astra-graph-node__glyph" aria-hidden="true">
          {KIND_GLYPHS[node.kind]}
        </span>
        <span className="astra-graph-node__copy">
          <small className="astra-graph-node__kind">{data.kicker}</small>
          <strong className="astra-graph-node__label">{node.label}</strong>
        </span>
      </button>
      <Handle
        className="astra-graph-node__handle"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
      />
    </>
  );
}

/** Expanded group frames sit behind the chips; the label collapses them. */
function GraphGroupFrame({ data }: NodeProps<GroupFlowNode>) {
  return (
    <div className="astra-graph-group">
      <button
        type="button"
        className="astra-graph-group__label nodrag"
        title={`Collapse ${data.label}`}
        onClick={() => data.onCollapse?.(data.label)}
      >
        {data.label}
      </button>
    </div>
  );
}

const nodeTypes = { astra: GraphNodeChip, 'astra-group': GraphGroupFrame };

function decisionSelectionLabel(node: GraphNode): string | undefined {
  if (node.nodeType !== 'record' || node.record.kind !== 'decision') {
    return undefined;
  }
  const record = node.record;
  const selected = record.options.find(
    (option) => option.id === record.selectedOptionId,
  );
  return selected?.label ?? record.selectedOptionId;
}

/**
 * The scope's decisions beside the flow (ported from the archived viewer):
 * a collapsible rail so methodological choices stay one glance away without
 * knotting the dataflow reading.
 */
function DecisionsRail({
  decisions,
  open,
  onToggle,
  onOpenRecord,
}: {
  decisions: readonly GraphNode[];
  open: boolean;
  onToggle: () => void;
  onOpenRecord: ((record: InventoryRecord, scope: InventoryScope) => void) | undefined;
}) {
  if (!decisions.length) return null;
  return (
    <aside
      className="astra-graph-rail"
      aria-label="Analysis decisions"
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="astra-graph-rail__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Decisions</span>
        <strong>{decisions.length}</strong>
        <small aria-hidden="true">{open ? '‹' : '›'}</small>
      </button>
      {open ? (
        <div className="astra-graph-rail__list">
          {decisions.map((decision) => {
            if (decision.nodeType !== 'record') return null;
            const selection = decisionSelectionLabel(decision);
            return (
              <button
                type="button"
                key={decision.id}
                className="astra-graph-rail__row"
                title={`${decision.label}${selection ? ` — ${selection}` : ''}`}
                onClick={() => onOpenRecord?.(decision.record, decision.scope)}
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

function flowNodes(
  derivation: GraphDerivation,
  onCollapseGroup: (label: string) => void,
): FlowNode[] {
  const layout = layoutProjectGraph(derivation);
  const frames = layout.groups.map((frame, index): GroupFlowNode => ({
    id: `group:${index}`,
    type: 'astra-group' as const,
    position: { x: frame.x, y: frame.y },
    width: frame.width,
    height: frame.height,
    zIndex: -1,
    draggable: false,
    selectable: false,
    focusable: false,
    data: { label: frame.label, onCollapse: onCollapseGroup },
  }));
  const chips = derivation.nodes.map((graphNode): ChipFlowNode => {
    const position = layout.positions.get(graphNode.id) ?? { x: 0, y: 0 };
    return {
      id: graphNode.id,
      type: 'astra' as const,
      position,
      width: GRAPH_NODE_WIDTH,
      height: GRAPH_NODE_HEIGHT,
      draggable: false,
      selectable: false,
      data: {
        graphNode,
        kicker: nodeKicker(graphNode),
        title: nodeTitle(graphNode),
      },
    };
  });
  return [...frames, ...chips];
}

function flowEdges(derivation: GraphDerivation): FlowEdge[] {
  return derivation.edges.map((edge) => {
    const family = edgeFamily(edge);
    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'smoothstep' as const,
      pathOptions: { borderRadius: 5 },
      className: `astra-graph-edge astra-graph-edge--${family}`,
      selectable: false,
      focusable: false,
      ariaLabel: edge.relationKinds.join(', '),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 11,
        height: 11,
        color: 'var(--astra-rule-strong)',
      },
    };
  });
}

export function GraphView({
  model,
  scopeId,
  organization,
  organizeHint,
  onOpenRecord,
  onOpenScope,
  className,
}: GraphViewProps) {
  // Groups read collapsed by default; expansion is per-view interaction
  // state, reset when the scope changes.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [railOpen, setRailOpen] = useState(true);
  useEffect(() => setExpandedGroups(new Set()), [scopeId, organization]);
  const collapseGroup = useCallback((label: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      next.delete(label);
      return next;
    });
  }, []);

  const derivation = useMemo(
    () => deriveProjectGraph(model, {
      ...(scopeId === undefined ? {} : { scopeId }),
      ...(organization === undefined ? {} : { organization }),
      expandedGroups,
    }),
    [model, scopeId, organization, expandedGroups],
  );
  const nodes = useMemo(
    () => flowNodes(derivation, collapseGroup),
    [derivation, collapseGroup],
  );
  const edges = useMemo(() => flowEdges(derivation), [derivation]);

  const handleNodeClick = useCallback<NodeMouseHandler<FlowNode>>(
    (_event, node) => {
      if (node.type !== 'astra') return;
      const graphNode = node.data.graphNode;
      if (graphNode.nodeType === 'record') {
        onOpenRecord?.(graphNode.record, graphNode.scope);
      } else if (graphNode.nodeType === 'group') {
        setExpandedGroups((current) => new Set(current).add(graphNode.label));
      } else {
        onOpenScope?.(graphNode.scope);
      }
    },
    [onOpenRecord, onOpenScope],
  );

  return (
    <div className={`astra-graph-view${className ? ` ${className}` : ''}`}>
      <DecisionsRail
        decisions={derivation.railDecisions}
        open={railOpen}
        onToggle={() => setRailOpen((current) => !current)}
        onOpenRecord={onOpenRecord}
      />
      {/* Remount on scope change so fitView re-frames the new derivation
          instead of keeping the previous scope's viewport transform. */}
      <ReactFlow<FlowNode, FlowEdge>
        key={scopeId ?? 'root'}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesReconnectable={false}
        edgesFocusable={false}
        panOnDrag
        preventScrolling
        minZoom={0.4}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        onNodeClick={handleNodeClick}
        aria-label={`Provenance graph: ${derivation.scope.name}`}
      >
        <Controls
          position="bottom-right"
          showInteractive={false}
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        />
      </ReactFlow>
      {organization == null && organizeHint != null ? (
        <p className="astra-graph-view__hint">{organizeHint}</p>
      ) : null}
    </div>
  );
}
