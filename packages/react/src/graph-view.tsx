import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  buildProjectGraph,
  type GraphOrganizationStatus,
  type ProjectGraphEdge,
  type ProjectGraphNode,
  type ProjectGraphScope,
} from './graph.js';
import { GraphFlowCanvas } from './graph-flow.js';
import type {
  ProjectRecordView,
  ProjectViewModelV1,
} from '@astra-spec/sdk/view-model';
import type { RuntimeOverlayV1, ViewerHost } from './viewer-types.js';
import { ResultViewer } from './result-viewer.js';
import { kindLabel } from './shared.js';
import {
  IconButton,
  ProjectViewHeader,
  SurfaceHeader,
  type SurfaceKind,
} from './ui.js';

const DECISION_PANEL_WIDTH = 264;
const DECISION_PANEL_COLLAPSED_WIDTH = 44;
const DECISION_PANEL_HEADER_HEIGHT = 42;
const DECISION_PANEL_ROW_HEIGHT = 38;

interface DisplayGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  decisions: ProjectGraphNode[];
  decisionEdges: ProjectGraphEdge[];
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

function statusCopy(status: GraphOrganizationStatus): string | undefined {
  if (status === 'stale_valid') {
    return 'The saved organization predates the current ASTRA analysis. Valid groups remain applied; new records stay exposed.';
  }
  if (status === 'stale_partly_invalid') {
    return 'Some saved groups no longer match the ASTRA analysis. Invalid groups have been expanded so no records disappear.';
  }
  return undefined;
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
  const [legendOpen, setLegendOpen] = useState(false);
  const [organizeError, setOrganizeError] = useState<string>();
  const [organizing, setOrganizing] = useState(false);

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
  const graphInsetLeft = displayGraph.decisions.length
    ? decisionPanelOpen ? DECISION_PANEL_WIDTH : DECISION_PANEL_COLLAPSED_WIDTH
    : 0;
  const inspectNode = useCallback((
    node: ProjectGraphNode,
    anchorX: number,
    anchorY: number,
  ) => {
    setActiveNodePopover({ nodeId: node.id, anchorX, anchorY });
  }, []);

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

  const enterScope = (scopeId: string) => {
    setFocusedScopeId(scopeId);
    setActiveNodePopover(undefined);
    setDecisionPanelOpen(false);
    setSelectedDecisionNodeId(undefined);
    setDecisionListScrollTop(0);
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
            <GraphLegend open={legendOpen} onToggle={() => setLegendOpen((value) => !value)} />
          </>
        )}
      />

      {warning ? <div className="astra-graph__warning" role="status">{warning}</div> : null}
      {organizeError ? <div className="astra-graph__warning" role="alert">{organizeError}</div> : null}

      <div className="astra-graph__viewport">
        <GraphFlowCanvas
          nodes={displayGraph.nodes}
          edges={displayGraph.edges}
          scopes={graph.scopes}
          insetLeft={graphInsetLeft}
          awaitingChoice={!choiceDismissed}
          {...(
            selectedDecision
            && selectedDecisionSourceY !== undefined
            ? {
                decisionTrace: {
                  markerId: `${markerBase}-arrow-decision-overlay`,
                  sourceX: DECISION_PANEL_WIDTH,
                  sourceY: selectedDecisionSourceY,
                  targetNodeIds: displayGraph.decisionEdges
                    .filter((edge) => edge.sourceNodeId === selectedDecision.id)
                    .map((edge) => edge.targetNodeId),
                },
              }
            : {}
          )}
          onInspect={inspectNode}
        />
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
