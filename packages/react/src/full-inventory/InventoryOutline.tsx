import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ProjectViewModelIndex,
  ProjectViewModelV1,
  RuntimeOverlayV1,
  ViewerHost,
} from '@lightcone-research/astra-ui-model';
import { AstraViewerProvider } from '../context.js';
import { DecisionDialog, DecisionsInventory } from './DecisionsInventory.js';
import { FindingDialog, FindingsInventory } from './FindingsInventory.js';
import { InputDialog, InputsInventory } from './InputsInventory.js';
import { InsightDetailDialog } from './InsightDetailDialog.js';
import { OutputDialog, OutputsInventory } from './OutputsInventory.js';
import {
  PaperDialog,
  PapersInventory,
  paperRecords,
  type InventoryPaper,
  type InventoryPaperMetadataMap,
} from './PapersInventory.js';
import {
  createInventoryModel,
  getInventoryScope,
  inventoryScopeForRecord,
  resolveInventoryRecordReference,
} from './model.js';
import { normalizeDoi } from './citationMetadata.js';
import type {
  InventoryInsightRecord,
  InventoryOpenReference,
  InventoryRecord,
  InventorySnapshot,
} from './types.js';

const EMPTY_PAPER_METADATA: InventoryPaperMetadataMap = {};

type InventoryModalEntry =
  | { kind: 'output'; record: InventoryRecord; scopeId: string }
  | { kind: 'decision'; record: InventoryRecord; scopeId: string }
  | { kind: 'input'; record: InventoryRecord; scopeId: string }
  | { kind: 'finding'; record: InventoryRecord; scopeId: string }
  | { kind: 'insight'; record: InventoryInsightRecord; scopeId: string }
  | {
      kind: 'paper';
      paper: InventoryPaper;
      scopeId: string;
      focusInsight?: InventoryInsightRecord | undefined;
    };

export interface InventoryOutlineProps {
  snapshot?: InventorySnapshot | undefined;
  /** Canonical input used by application hosts such as JupyterLab. */
  model?: ProjectViewModelV1 | ProjectViewModelIndex | undefined;
  runtime?: RuntimeOverlayV1 | undefined;
  host?: ViewerHost | undefined;
  scopeId?: string | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  /** Host-specific directory containing the PDF.js runtime assets. */
  paperPdfAssetBaseUrl?: string | undefined;
  decisionTagLabels?: Readonly<Record<string, string>> | undefined;
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

function InventoryExplorerView({
  snapshot,
  scopeId = 'root',
  paperMetadata = EMPTY_PAPER_METADATA,
  paperPdfAssetBaseUrl,
  decisionTagLabels = {},
  dialogsOnly = false,
  openReference,
  onClose,
  onOpenReference,
}: InventoryOutlineProps) {
  const [modalStack, setModalStack] = useState<InventoryModalEntry[]>([]);
  const model = useMemo(() => snapshot ? createInventoryModel(snapshot) : undefined, [snapshot]);

  useEffect(() => setModalStack([]), [scopeId]);
  useEffect(() => {
    if (!model || !openReference) return;
    const fallbackScope = getInventoryScope(model, scopeId)
      ?? model.snapshot.scopes[0];
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
      openReference.path
        ? model.recordByPath.get(openReference.path)
        : undefined
    ) ?? resolveInventoryRecordReference(
      model,
      fallbackScope,
      openReference.path ?? openReference.id,
      openReference.kind,
    );
    if (!located || located.record.kind !== openReference.kind) return;
    const { record, scope } = located;
    if (record.kind === 'prior_insight') {
      setModalStack([{
        kind: 'insight',
        record: record as InventoryInsightRecord,
        scopeId: scope.id,
      }]);
    } else {
      setModalStack([{ kind: record.kind, record, scopeId: scope.id }]);
    }
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
    onOpenReference(
      {
        kind:
          entry.kind === 'insight'
            ? 'prior_insight'
            : entry.kind,
        id: entry.record.id,
        path: entry.record.path,
      },
      entry.scopeId,
    );
  };
  const pushModal = (entry: InventoryModalEntry) => setModalStack((stack) => [...stack, entry]);
  const goBack = () => setModalStack((stack) => stack.slice(0, -1));
  const closeAll = () => {
    setModalStack([]);
    onClose?.();
  };
  const activeModal = modalStack[modalStack.length - 1];
  const activeScope = model && activeModal
    ? getInventoryScope(model, activeModal.scopeId)
    : undefined;
  const backAction = modalStack.length > 1 ? goBack : undefined;

  let modal: ReactNode = null;
  if (model && activeModal && activeScope) {
    if (activeModal.kind === 'output') {
      modal = (
        <OutputDialog
          record={activeModal.record}
          scope={activeScope}
          model={model}
          onOpenDependency={(record, scope) => {
            if (
              record.kind === 'output'
              || record.kind === 'input'
              || record.kind === 'decision'
            ) {
              pushModal({ kind: record.kind, record, scopeId: scope.id });
            }
          }}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    } else if (activeModal.kind === 'input') {
      modal = (
        <InputDialog
          record={activeModal.record}
          scope={activeScope}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    } else if (activeModal.kind === 'decision') {
      modal = (
        <DecisionDialog
          record={activeModal.record}
          scope={activeScope}
          model={model}
          onOpenInsight={(insight) => pushModal({
            kind: 'insight',
            record: insight,
            scopeId: inventoryScopeForRecord(model, insight, activeScope)!.id,
          })}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    } else if (activeModal.kind === 'finding') {
      modal = (
        <FindingDialog
          record={activeModal.record}
          scope={activeScope}
          model={model}
          onOpenEvidence={(output, scope) => pushModal({
            kind: 'output',
            record: output,
            scopeId: scope.id,
          })}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    } else if (activeModal.kind === 'insight') {
      const insightDoi = activeModal.record.doi;
      const sourcePaper = insightDoi
        ? paperRecords(model, activeScope, paperMetadata)
          .find((paper) => normalizeDoi(paper.doi) === normalizeDoi(insightDoi))
        : undefined;
      modal = (
        <InsightDetailDialog
          insight={activeModal.record}
          model={model}
          scope={activeScope}
          onOpenSource={sourcePaper ? () => pushModal({
            kind: 'paper',
            paper: sourcePaper,
            scopeId: activeScope.id,
            focusInsight: activeModal.record,
          }) : undefined}
          onOpenDecision={(decision) => pushModal({
            kind: 'decision',
            record: decision,
            scopeId: inventoryScopeForRecord(model, decision, activeScope)!.id,
          })}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    } else {
      modal = (
        <PaperDialog
          paper={activeModal.paper}
          scope={activeScope}
          initialFocusInsight={activeModal.focusInsight}
          pdfAssetBaseUrl={paperPdfAssetBaseUrl}
          onOpenInsight={(insight) => pushModal({
            kind: 'insight',
            record: insight,
            scopeId: inventoryScopeForRecord(model, insight, activeScope)!.id,
          })}
          onOpenDecision={(decision) => pushModal({
            kind: 'decision',
            record: decision,
            scopeId: inventoryScopeForRecord(model, decision, activeScope)!.id,
          })}
          onBack={backAction}
          onClose={closeAll}
        />
      );
    }
  }

  if (dialogsOnly) return <>{modal}</>;

  const sections = [
    {
      id: 'outputs',
      label: 'Outputs',
      content: model ? (
        <OutputsInventory
          model={model}
          scopeId={scopeId}
          onOpenOutput={(record, scope) => openFromOverview({
            kind: 'output',
            record,
            scopeId: scope.id,
          })}
        />
      ) : null,
    },
    {
      id: 'decisions',
      label: 'Decisions',
      content: model ? (
        <DecisionsInventory
          model={model}
          scopeId={scopeId}
          tagLabels={decisionTagLabels}
          onOpenDecision={(record, scope) => openFromOverview({
            kind: 'decision',
            record,
            scopeId: scope.id,
          })}
        />
      ) : null,
    },
    {
      id: 'inputs',
      label: 'Inputs',
      content: model ? (
        <InputsInventory
          model={model}
          scopeId={scopeId}
          onOpenInput={(record, scope) => openFromOverview({
            kind: 'input',
            record,
            scopeId: scope.id,
          })}
        />
      ) : null,
    },
    {
      id: 'findings',
      label: 'Findings',
      content: model ? (
        <FindingsInventory
          model={model}
          scopeId={scopeId}
          onOpenFinding={(record, scope) => openFromOverview({
            kind: 'finding',
            record,
            scopeId: scope.id,
          })}
        />
      ) : null,
    },
    {
      id: 'papers',
      label: 'Papers',
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
      <div className="inventory-outline__sections">
        {sections.map((item, index) => (
          <section
            key={item.id}
            className={`inventory-outline__section inventory-outline__section--${item.id}`}
          >
            <h2 id={item.id} tabIndex={-1}>
              <span className="heading-text">{index + 1}. {item.label}</span>
            </h2>
            {item.content}
            {!model ? (
              <div className="inventory-outline__empty-slot" aria-hidden="true" />
            ) : null}
          </section>
        ))}
      </div>
      {modal}
    </div>
  );
}

/**
 * The complete ASTRA inventory and detail experience.
 *
 * Application hosts pass the canonical model/runtime/host contract. The
 * legacy snapshot prop remains temporarily for MyST fixtures and downstream
 * compatibility while those producers migrate.
 */
export function InventoryExplorer(props: InventoryOutlineProps) {
  const projectedSnapshot = useMemo(
    () => props.model
      ? createInventoryModel(props.model, props.runtime).snapshot
      : props.snapshot,
    [props.model, props.runtime, props.snapshot],
  );
  const view = (
    <InventoryExplorerView
      {...props}
      snapshot={projectedSnapshot}
    />
  );
  if (!props.model) return view;
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

/** Backwards-compatible name for the inventory's original public entry point. */
export const InventoryOutline = InventoryExplorer;
