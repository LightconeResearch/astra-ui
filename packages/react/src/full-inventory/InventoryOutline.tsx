import { useEffect, useMemo, useState } from 'react';
import type {
  ProjectViewModelIndex,
  ProjectViewModelV1,
} from '@astra-spec/sdk/view-model';
import type { RuntimeOverlayV1, ViewerHost } from '../viewer-types.js';
import { AstraViewerProvider } from '../context.js';
import { DecisionDialog, DecisionsInventory } from './DecisionsInventory.js';
import { FindingDialog, FindingsInventory } from './FindingsInventory.js';
import { InputDialog, InputsInventory } from './InputsInventory.js';
import { InsightDetailDialog } from './InsightDetailDialog.js';
import {
  InventoryDetailPresentation,
  type InventoryDetailMode,
} from './InventoryPrimitives.js';
import { OutputDialog, OutputsInventory } from './OutputsInventory.js';
import { PriorInsightsInventory } from './PriorInsightsInventory.js';
import {
  PaperDialog,
  PapersInventory,
  paperRecords,
  type InventoryPaper,
  type InventoryPaperMetadata,
  type InventoryPaperMetadataMap,
} from './PapersInventory.js';
import {
  type InventoryModel,
  createInventoryModel,
  getInventoryScope,
  inventoryRecordsOfKind,
  inventoryScopeForRecord,
  resolveInventoryRecordReference,
} from './model.js';
import { normalizeDoi } from './citationMetadata.js';
import type {
  InventoryOpenReference,
  InventoryRecord,
  InventoryScope,
} from '../types.js';

const EMPTY_PAPER_METADATA: InventoryPaperMetadataMap = {};

type InventoryModalEntry =
  | { kind: 'record'; record: InventoryRecord; scopeId: string }
  | {
      kind: 'paper';
      paper: InventoryPaper;
      scopeId: string;
      focusInsight?: Extract<InventoryRecord, { kind: 'prior_insight' }> | undefined;
    };

function recordModalEntry(
  record: InventoryRecord,
  ownerScopeId: string,
): InventoryModalEntry {
  return { kind: 'record', record, scopeId: ownerScopeId };
}

function modalEntryCrumb(entry: InventoryModalEntry): string {
  return entry.kind === 'paper'
    ? entry.paper.title
    : entry.record.localId;
}

interface InventoryRecordDetailProps {
  entry: InventoryModalEntry;
  scope: InventoryScope;
  model: InventoryModel;
  paperMetadata: InventoryPaperMetadataMap;
  paperPdfAssetBaseUrl?: string | undefined;
  onFetchPaper?: ((doi: string) => Promise<InventoryPaperMetadata>) | undefined;
  onPush: (entry: InventoryModalEntry) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

/** The sole discriminator from a canonical ASTRA record to rich detail UI. */
function InventoryRecordDetail({
  entry,
  scope,
  model,
  paperMetadata,
  paperPdfAssetBaseUrl,
  onFetchPaper,
  onPush,
  onBack,
  onClose,
}: InventoryRecordDetailProps) {
  const openRecord = (record: InventoryRecord, owner?: InventoryScope) => {
    const resolvedOwner = owner ?? inventoryScopeForRecord(model, record, scope);
    if (resolvedOwner) onPush(recordModalEntry(record, resolvedOwner.id));
  };

  if (entry.kind === 'paper') {
    return (
      <PaperDialog
        paper={entry.paper}
        scope={scope}
        initialFocusInsight={entry.focusInsight}
        pdfAssetBaseUrl={paperPdfAssetBaseUrl}
        onFetchPaper={onFetchPaper}
        onOpenInsight={(insight) => openRecord(insight)}
        onOpenDecision={(decision) => openRecord(decision)}
        onBack={onBack}
        onClose={onClose}
      />
    );
  }

  const { record } = entry;
  switch (record.kind) {
    case 'output':
      return (
        <OutputDialog
          record={record}
          scope={scope}
          model={model}
          onOpenDependency={(dependency, owner) => {
            if (
              dependency.kind === 'output'
              || dependency.kind === 'input'
              || dependency.kind === 'decision'
            ) {
              openRecord(dependency, owner);
            }
          }}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'input':
      return (
        <InputDialog
          record={record}
          scope={scope}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'decision':
      return (
        <DecisionDialog
          record={record}
          scope={scope}
          model={model}
          onOpenInsight={(insight) => openRecord(insight)}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'finding':
      return (
        <FindingDialog
          record={record}
          scope={scope}
          model={model}
          onOpenEvidence={(output, owner) => openRecord(output, owner)}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'prior_insight': {
      const insightDoi = record.evidence.find((evidence) => evidence.doi)?.doi;
      const sourcePaper = insightDoi
        ? paperRecords(model, scope, paperMetadata)
          .find((paper) => normalizeDoi(paper.doi) === normalizeDoi(insightDoi))
        : undefined;
      return (
        <InsightDetailDialog
          insight={record}
          model={model}
          scope={scope}
          onOpenSource={sourcePaper ? () => onPush({
            kind: 'paper',
            paper: sourcePaper,
            scopeId: scope.id,
            focusInsight: record,
          }) : undefined}
          onOpenDecision={(decision) => openRecord(decision)}
          onBack={onBack}
          onClose={onClose}
        />
      );
    }
  }
}

export interface InventoryOutlineProps {
  model: ProjectViewModelV1 | ProjectViewModelIndex;
  runtime?: RuntimeOverlayV1 | undefined;
  host?: ViewerHost | undefined;
  scopeId?: string | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  /** Host-specific directory containing the PDF.js runtime assets. */
  paperPdfAssetBaseUrl?: string | undefined;
  /** Fetch one missing cited paper into the host's user cache. */
  onFetchPaper?: ((doi: string) => Promise<InventoryPaperMetadata>) | undefined;
  decisionTagLabels?: Readonly<Record<string, string>> | undefined;
  /** Render record details as a modal or as a host-owned full detail page. */
  detailMode?: InventoryDetailMode | undefined;
  dialogsOnly?: boolean | undefined;
  openReference?: InventoryOpenReference | undefined;
  /** Notified when the shared detail stack closes from its UI. */
  onClose?: (() => void) | undefined;
  /**
   * Optional host boundary for selections made from the inventory overview.
   * When provided, initial selections are delegated to the host while links
   * inside an open detail continue to use this component's back stack.
   */
  onOpenReference?: (
    reference: InventoryOpenReference,
    scopeId: string,
  ) => void;
}

interface InventoryExplorerViewProps
  extends Omit<InventoryOutlineProps, 'model' | 'runtime' | 'host'> {
  inventory: InventoryModel;
}

function InventoryExplorerView({
  inventory: model,
  scopeId = 'root',
  paperMetadata = EMPTY_PAPER_METADATA,
  paperPdfAssetBaseUrl,
  onFetchPaper,
  decisionTagLabels = {},
  detailMode = 'modal',
  dialogsOnly = false,
  openReference,
  onClose,
  onOpenReference,
}: InventoryExplorerViewProps) {
  const [modalStack, setModalStack] = useState<InventoryModalEntry[]>([]);

  useEffect(() => setModalStack([]), [scopeId]);
  useEffect(() => {
    if (!openReference) return;
    const fallbackScope = getInventoryScope(model, scopeId)
      ?? model.model.scopes[0];
    if (!fallbackScope) return;
    if (openReference.kind === 'paper') {
      const paper = paperRecords(model, fallbackScope, paperMetadata)
        .find((candidate) =>
          normalizeDoi(candidate.doi) === normalizeDoi(openReference.doi)
        );
      if (!paper) return;
      setModalStack([{
        kind: 'paper',
        paper,
        scopeId: fallbackScope.id,
      }]);
      return;
    }
    const located = (
      openReference.canonicalPath
        ? model.recordByPath.get(openReference.canonicalPath)
        : undefined
    ) ?? resolveInventoryRecordReference(
      model,
      fallbackScope,
      openReference.canonicalPath ?? openReference.id,
      openReference.kind,
    );
    if (!located || located.record.kind !== openReference.kind) return;
    const { record, scope } = located;
    setModalStack([recordModalEntry(record, scope.id)]);
  }, [model, openReference, paperMetadata, scopeId]);

  const startModal = (entry: InventoryModalEntry) => setModalStack([entry]);
  const openFromOverview = (entry: InventoryModalEntry) => {
    if (!onOpenReference) {
      startModal(entry);
      return;
    }
    if (entry.kind === 'paper') {
      onOpenReference(
        { kind: 'paper', doi: entry.paper.doi },
        entry.scopeId,
      );
      return;
    }
    onOpenReference({
      kind: entry.record.kind,
      id: entry.record.id,
      canonicalPath: entry.record.canonicalPath,
    }, entry.scopeId);
  };
  const pushModal = (entry: InventoryModalEntry) => setModalStack((stack) => [...stack, entry]);
  const goBack = () => setModalStack((stack) => stack.slice(0, -1));
  const closeAll = () => {
    setModalStack([]);
    onClose?.();
  };
  const activeModal = modalStack[modalStack.length - 1];
  const activeScope = activeModal
    ? getInventoryScope(model, activeModal.scopeId)
    : undefined;
  const backAction = modalStack.length > 1 ? goBack : undefined;
  const previousModal = modalStack.length > 1
    ? modalStack[modalStack.length - 2]
    : undefined;

  const modal = activeModal && activeScope ? (
    <InventoryDetailPresentation
      mode={detailMode}
      backLabel="Back to previous record"
      backText={previousModal ? modalEntryCrumb(previousModal) : undefined}
    >
      <InventoryRecordDetail
        entry={activeModal}
        scope={activeScope}
        model={model}
        paperMetadata={paperMetadata}
        paperPdfAssetBaseUrl={paperPdfAssetBaseUrl}
        onFetchPaper={onFetchPaper}
        onPush={pushModal}
        onBack={backAction}
        onClose={closeAll}
      />
    </InventoryDetailPresentation>
  ) : null;

  if (dialogsOnly) return <>{modal}</>;

  const scope = getInventoryScope(model, scopeId);
  const outputs = scope ? inventoryRecordsOfKind(scope, 'output', model) : [];
  const decisions = scope ? inventoryRecordsOfKind(scope, 'decision', model) : [];
  const inputs = scope ? inventoryRecordsOfKind(scope, 'input', model) : [];
  const findings = scope ? inventoryRecordsOfKind(scope, 'finding', model) : [];
  const priorInsights = scope ? inventoryRecordsOfKind(scope, 'prior_insight', model) : [];
  const papers = scope ? paperRecords(model, scope, paperMetadata) : [];

  const sections = [
    {
      id: 'outputs',
      label: 'Outputs',
      count: outputs.length,
      countLabel: `${outputs.length} ${outputs.length === 1 ? 'output' : 'outputs'}`,
      glyph: '◆',
      content: model ? (
        <OutputsInventory
          model={model}
          scopeId={scopeId}
          onOpenOutput={(record, scope) => openFromOverview(
            recordModalEntry(record, scope.id),
          )}
        />
      ) : null,
    },
    {
      id: 'decisions',
      label: 'Decisions',
      count: decisions.length,
      countLabel: `${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'}`,
      glyph: '◇',
      content: model ? (
        <DecisionsInventory
          model={model}
          scopeId={scopeId}
          tagLabels={decisionTagLabels}
          onOpenDecision={(record, scope) => openFromOverview(
            recordModalEntry(record, scope.id),
          )}
        />
      ) : null,
    },
    {
      id: 'inputs',
      label: 'Inputs',
      count: inputs.length,
      countLabel: `${inputs.length} ${inputs.length === 1 ? 'input' : 'inputs'}`,
      glyph: '↳',
      content: model ? (
        <InputsInventory
          model={model}
          scopeId={scopeId}
          onOpenInput={(record, scope) => openFromOverview(
            recordModalEntry(record, scope.id),
          )}
        />
      ) : null,
    },
    {
      id: 'findings',
      label: 'Findings',
      count: findings.length,
      countLabel: `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`,
      glyph: '●',
      content: model ? (
        <FindingsInventory
          model={model}
          scopeId={scopeId}
          onOpenFinding={(record, scope) => openFromOverview(
            recordModalEntry(record, scope.id),
          )}
        />
      ) : null,
    },
    {
      id: 'prior-insights',
      label: 'Prior Insights',
      count: priorInsights.length,
      countLabel: `${priorInsights.length} prior ${priorInsights.length === 1 ? 'insight' : 'insights'}`,
      glyph: '◈',
      content: model ? (
        <PriorInsightsInventory
          model={model}
          scopeId={scopeId}
          onOpenInsight={(record, scope) => openFromOverview(
            recordModalEntry(record, scope.id),
          )}
        />
      ) : null,
    },
    {
      id: 'papers',
      label: 'Papers',
      count: papers.length,
      countLabel: `${papers.length} cited ${papers.length === 1 ? 'work' : 'works'}`,
      glyph: '▧',
      content: model ? (
        <PapersInventory
          model={model}
          scopeId={scopeId}
          paperMetadata={paperMetadata}
          onOpenPaper={(paper, scope) => openFromOverview({
            kind: 'paper',
            paper,
            scopeId: scope.id,
          })}
        />
      ) : null,
    },
  ];

  return (
    <div className="inventory-outline">
      <div className="inventory-page-layout">
        <div className="inventory-outline__sections">
          {sections.map((item) => (
            <section
              key={item.id}
              className={`inventory-outline__section inventory-outline__section--${item.id}`}
            >
              <div className="inventory-section-heading">
                <h2 id={item.id} tabIndex={-1}>
                  <span className="heading-text">{item.label}</span>
                </h2>
                <span>{item.countLabel}</span>
              </div>
              {item.content}
            </section>
          ))}
        </div>
        <aside className="inventory-page-outline" aria-label="Inventory outline">
          <h3>On this page</h3>
          <nav>
            {sections.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                <span className={`inventory-page-outline__glyph is-${item.id}`} aria-hidden="true">
                  {item.glyph}
                </span>
                <span>{item.label}</span>
                <span>{item.count}</span>
              </a>
            ))}
          </nav>
        </aside>
      </div>
      {modal}
    </div>
  );
}

/**
 * The complete ASTRA inventory and detail experience.
 *
 * Application hosts pass the canonical model/runtime/host contract.
 */
export function InventoryExplorer(props: InventoryOutlineProps) {
  const inventory = useMemo(
    () => createInventoryModel(props.model, props.runtime),
    [props.model, props.runtime],
  );
  const view = (
    <InventoryExplorerView
      {...props}
      inventory={inventory}
    />
  );
  const model = 'model' in props.model ? props.model.model : props.model;
  return (
    <AstraViewerProvider
      model={model}
      {...(props.runtime ? { runtime: props.runtime } : {})}
      {...(props.host ? { host: props.host } : {})}
    >
      {view}
    </AstraViewerProvider>
  );
}
