import dagre from '@dagrejs/dagre';
import {
  Controls,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  ProjectGraphEdge,
  ProjectGraphNode,
  ProjectGraphScope,
} from './graph.js';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 54;

type EdgeVisualKind = 'flow' | 'scope' | 'decision' | 'evidence' | 'reference';

interface AstraFlowNodeData extends Record<string, unknown> {
  graphNode: ProjectGraphNode;
  detail?: string;
  title: string;
}

type AstraFlowNode = Node<AstraFlowNodeData, 'astra'>;
type AstraFlowEdge = Edge<{
  relationKinds: string[];
  visualKind: EdgeVisualKind;
}>;

export interface DecisionTrace {
  markerId: string;
  sourceX: number;
  sourceY: number;
  targetNodeIds: string[];
}

export interface GraphFlowCanvasProps {
  nodes: readonly ProjectGraphNode[];
  edges: readonly ProjectGraphEdge[];
  scopes: readonly ProjectGraphScope[];
  insetLeft: number;
  awaitingChoice: boolean;
  decisionTrace?: DecisionTrace;
  onInspect: (node: ProjectGraphNode, anchorX: number, anchorY: number) => void;
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

function edgeColor(kind: EdgeVisualKind): string {
  if (kind === 'scope' || kind === 'reference') return 'var(--astra-c-analysis)';
  if (kind === 'decision') return 'var(--astra-c-decision)';
  if (kind === 'evidence') return 'var(--astra-c-insight)';
  return 'var(--astra-muted)';
}

function nodeDetail(
  node: ProjectGraphNode,
  scope?: ProjectGraphScope,
): string | undefined {
  if (node.nodeType === 'scope') {
    return `Sub-analysis · ${node.recordCount} records · click to inspect`;
  }
  if (node.kind === 'output' && scope?.depth) return `From ${scope.name}`;
  return undefined;
}

function nodeTitle(node: ProjectGraphNode): string {
  if (node.nodeType === 'scope') {
    return `${node.label} ASTRA sub-analysis; click to inspect`;
  }
  if (node.nodeType === 'group') {
    return `${node.label}: ${node.memberRecordIds.length} grouped records`;
  }
  return `${node.label}: ${node.canonicalPath}`;
}

function GraphNode({ data }: NodeProps<AstraFlowNode>) {
  const node = data.graphNode;
  return (
    <>
      <Handle
        className="astra-graph-node__handle"
        type="target"
        position={Position.Top}
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
          {node.nodeType === 'group' ? (
            <span className="astra-graph-node__group-mark">
              <span className="astra-graph-node__mark astra-graph-node__mark--group-back" />
              <span className="astra-graph-node__mark astra-graph-node__mark--group-front" />
            </span>
          ) : (
            <span className="astra-graph-node__mark" />
          )}
        </span>
        <span className="astra-graph-node__copy">
          {node.nodeType === 'scope' ? (
            <small className="astra-graph-node__scope">Sub-analysis</small>
          ) : null}
          <strong className="astra-graph-node__label">{node.label}</strong>
          {data.detail ? (
            <small className="astra-graph-node__detail">{data.detail}</small>
          ) : null}
        </span>
      </button>
      <Handle
        className="astra-graph-node__handle"
        type="source"
        position={Position.Bottom}
      />
    </>
  );
}

const nodeTypes = { astra: GraphNode };

function layoutNodes(
  nodes: readonly ProjectGraphNode[],
  edges: readonly ProjectGraphEdge[],
  scopes: readonly ProjectGraphScope[],
): AstraFlowNode[] {
  const layout = new dagre.graphlib.Graph({ multigraph: true })
    .setDefaultEdgeLabel(() => ({}))
    .setGraph({
      rankdir: 'TB',
      ranker: 'network-simplex',
      acyclicer: 'greedy',
      nodesep: 42,
      edgesep: 18,
      ranksep: 74,
      marginx: 64,
      marginy: 54,
    });
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]));
  for (const node of nodes) {
    layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    layout.setEdge(edge.sourceNodeId, edge.targetNodeId, {}, edge.id);
  }
  dagre.layout(layout);

  return nodes.map((graphNode) => {
    const position = layout.node(graphNode.id) as { x: number; y: number };
    const detail = nodeDetail(graphNode, scopeById.get(graphNode.scopeId));
    const title = nodeTitle(graphNode);
    return {
      id: graphNode.id,
      type: 'astra',
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: false,
      focusable: false,
      ariaLabel: title,
      data: {
        graphNode,
        ...(detail ? { detail } : {}),
        title,
      },
    };
  });
}

function flowEdges(edges: readonly ProjectGraphEdge[]): AstraFlowEdge[] {
  return edges.map((edge) => {
    const visualKind = edgeVisualKind(edge);
    return {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      type: 'smoothstep',
      className: `astra-graph-edge astra-graph-edge--${visualKind}`,
      selectable: false,
      focusable: true,
      ariaLabel: edge.relationKinds.join(', '),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor(visualKind),
        width: 14,
        height: 14,
      },
      data: {
        relationKinds: [...edge.relationKinds],
        visualKind,
      },
    };
  });
}

function decisionTracePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  return getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.34,
  })[0];
}

export function GraphFlowCanvas({
  nodes,
  edges,
  scopes,
  insetLeft,
  awaitingChoice,
  decisionTrace,
  onInspect,
}: GraphFlowCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReactFlowInstance<AstraFlowNode, AstraFlowEdge>>();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const inspect = useCallback((
    event: ReactMouseEvent<Element>,
    node: AstraFlowNode,
  ) => {
    const bounds = rootRef.current?.getBoundingClientRect();
    onInspect(
      node.data.graphNode,
      event.clientX - (bounds?.left ?? 0) + 12,
      event.clientY - (bounds?.top ?? 0) + 12,
    );
  }, [onInspect]);
  const flowNodes = useMemo(
    () => layoutNodes(nodes, edges, scopes),
    [edges, nodes, scopes],
  );
  const edgesForFlow = useMemo(() => flowEdges(edges), [edges]);
  const flowNodeById = useMemo(
    () => new Map(flowNodes.map((node) => [node.id, node])),
    [flowNodes],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void instanceRef.current?.fitView({ padding: 0.14, duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowNodes, insetLeft]);

  return (
    <div
      ref={rootRef}
      className="astra-graph__flow-layer"
      data-awaiting-choice={awaitingChoice ? 'true' : 'false'}
    >
      <div className="astra-graph__flow" style={{ left: insetLeft }}>
        <ReactFlow<AstraFlowNode, AstraFlowEdge>
          nodes={flowNodes}
          edges={edgesForFlow}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesReconnectable={false}
          panOnDrag={!awaitingChoice}
          zoomOnScroll={!awaitingChoice}
          zoomOnPinch={!awaitingChoice}
          zoomOnDoubleClick={!awaitingChoice}
          preventScrolling
          minZoom={0.45}
          maxZoom={1.6}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          onNodeClick={inspect}
          onInit={(instance) => {
            instanceRef.current = instance;
            setViewport(instance.getViewport());
          }}
          onViewportChange={setViewport}
          aria-label="Interactive ASTRA graph canvas"
        >
          <Controls
            position="bottom-right"
            showInteractive={false}
            fitViewOptions={{ padding: 0.14 }}
          />
        </ReactFlow>
      </div>

      {decisionTrace ? (
        <svg className="astra-graph__decision-links" aria-hidden="true">
          <defs>
            <marker
              id={decisionTrace.markerId}
              viewBox="0 0 7 7"
              refX="6"
              refY="3.5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path className="astra-graph-edge__arrow" d="M 0 0 L 7 3.5 L 0 7 z" />
            </marker>
          </defs>
          {decisionTrace.targetNodeIds.map((targetNodeId) => {
            const target = flowNodeById.get(targetNodeId);
            if (!target) return null;
            const targetX = insetLeft + target.position.x * viewport.zoom + viewport.x;
            const targetY = (
              (target.position.y + NODE_HEIGHT / 2) * viewport.zoom + viewport.y
            );
            return (
              <path
                key={targetNodeId}
                className="astra-graph-edge astra-graph-edge--decision"
                d={decisionTracePath(
                  decisionTrace.sourceX,
                  decisionTrace.sourceY,
                  targetX,
                  targetY,
                )}
                markerEnd={`url(#${decisionTrace.markerId})`}
              />
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
