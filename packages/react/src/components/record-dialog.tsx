import type {
  AnalysisIndex,
  ResolvedAnalysisDocument,
  ResolvedAnalysisNode,
  ResolvedDecision,
  ResolvedInsight,
  ResolvedOutput,
  ResolvedRecord,
} from '@astra-spec/sdk';
import type { ReactNode } from 'react';
import { locateRecord } from '../model/locate-record.js';
import { findPaper, paperMetadataFor, type InventoryPaper, type InventoryPaperMetadataMap } from '../model/papers.js';
import { isInsight, isVisualOutput, recordTitle } from '../model/records.js';
import { decisionInsights, findingEvidence, informedDecisions, outputRelations } from '../model/relations.js';
import { useLabels } from '../lib/labels.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { DetailDialog, type DetailDialogProps, type DialogLayout } from '../primitives/dialog.js';
import type { SurfaceKind } from '../primitives/kind.js';
import type { TextRenderer } from '../primitives/prose.js';
import { DecisionDetail } from './decision-detail.js';
import type { DetailEntry } from './detail-entry.js';
import { FindingDetail } from './finding-detail.js';
import { InputDetail } from './input-detail.js';
import { InsightDetail } from './insight-detail.js';
import { OutputDetail, OutputDialogActions, useOutputExpanded } from './output-detail.js';
import { PaperDetail, PaperDialogActions, type PaperRenderer } from './paper-detail.js';

export interface RecordDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'> {
  entry: DetailEntry;
  document: ResolvedAnalysisDocument;
  index: AnalysisIndex;
  /** Papers in scope, from `collectInventoryPapers()`; needed for paper entries and insight sources. */
  papers?: readonly InventoryPaper[] | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  onFetchPaper?: ((doi: string) => void) | undefined;
  /** Navigation to another record from within the detail (drill-down). */
  onOpenRecord?: ((record: ResolvedRecord, analysis: ResolvedAnalysisNode) => void) | undefined;
  onOpenPaper?: ((doi: string, analysis: ResolvedAnalysisNode, focusInsightPath?: string) => void) | undefined;
  /** Body rendered (inside the dialog shell) when the entry no longer resolves, e.g. after a document refresh; nothing renders without it. */
  fallback?: ReactNode | undefined;
}

interface Chrome {
  kind: SurfaceKind;
  kindLabel: ReactNode;
  title: ReactNode;
  layout?: DialogLayout | undefined;
  actions?: ReactNode | undefined;
  body: ReactNode;
}

/**
 * Renders the right detail dialog for a stack entry, deriving relations,
 * evidence, insights, and papers from the index. One persistent dialog
 * element hosts every kind, so drilling down keeps focus and the top layer.
 */
export function RecordDialog({
  entry,
  document,
  index,
  papers = [],
  paperMetadata = {},
  renderArtifact,
  renderText,
  renderPaper,
  onOpenArtifact,
  onFetchPaper,
  onOpenRecord,
  onOpenPaper,
  fallback = null,
  ...dialog
}: RecordDialogProps) {
  const labels = useLabels();
  const analysis = index.analysisByPath.get(entry.analysisPath);
  const located = entry.kind === 'record' ? locateRecord(index, entry.canonicalPath) : undefined;
  const paper = entry.kind === 'paper' ? findPaper(papers, entry.doi) : undefined;
  const output = located?.record.kind === 'output' ? located.record : undefined;
  const [expanded, setExpanded] = useOutputExpanded(output ?? PLACEHOLDER_OUTPUT);

  const openByPath = (canonicalPath: string) => {
    const target = locateRecord(index, canonicalPath);
    if (target) onOpenRecord?.(target.record, target.analysis);
  };
  const openInsight = (insight: ResolvedInsight) => { openByPath(insight.canonicalPath); };
  const openDecision = (decision: ResolvedDecision) => { openByPath(decision.canonicalPath); };

  let chrome: Chrome | undefined;
  if (entry.kind === 'paper' && paper && analysis) {
    const focusRecord = entry.focusInsightPath ? index.recordByPath.get(entry.focusInsightPath) : undefined;
    chrome = {
      kind: 'paper',
      kindLabel: labels.kinds.paper,
      title: paper.title,
      layout: 'reader',
      actions: <PaperDialogActions record={paper} />,
      body: (
        <PaperDetail
          record={paper}
          metadata={paperMetadataFor(paper.doi, paperMetadata)}
          focusInsight={isInsight(focusRecord) ? focusRecord : undefined}
          renderText={renderText}
          renderPaper={renderPaper}
          onFetchPaper={onFetchPaper}
          onOpenInsight={openInsight}
          onOpenDecision={openDecision}
        />
      ),
    };
  } else if (located && analysis) {
    const { record } = located;
    switch (record.kind) {
      case 'output':
        chrome = {
          kind: 'output',
          kindLabel: record.type,
          title: recordTitle(record),
          layout: isVisualOutput(record) ? 'reader' : undefined,
          actions: (
            <OutputDialogActions record={record} onOpenArtifact={onOpenArtifact} expanded={expanded} onExpandedChange={setExpanded} />
          ),
          body: (
            <OutputDetail
              record={record}
              relations={outputRelations(index, record)}
              renderArtifact={renderArtifact}
              renderText={renderText}
              onOpenRecord={onOpenRecord}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          ),
        };
        break;
      case 'input':
        chrome = {
          kind: 'input',
          kindLabel: labels.kinds.input,
          title: recordTitle(record),
          body: <InputDetail record={record} renderText={renderText} />,
        };
        break;
      case 'decision':
        chrome = {
          kind: 'decision',
          kindLabel: labels.kinds.decision,
          title: recordTitle(record),
          body: (
            <DecisionDetail
              record={record}
              insights={decisionInsights(index, record)}
              renderText={renderText}
              onOpenInsight={openInsight}
            />
          ),
        };
        break;
      case 'finding':
        chrome = {
          kind: 'finding',
          kindLabel: labels.kinds.finding,
          title: record.claim,
          body: (
            <FindingDetail
              record={record}
              evidence={findingEvidence(index, record)}
              renderText={renderText}
              onOpenRecord={onOpenRecord}
            />
          ),
        };
        break;
      case 'prior_insight': {
        const sourceDoi = record.evidence.find(({ doi }) => doi)?.doi;
        const sourcePaper = sourceDoi ? findPaper(papers, sourceDoi) : undefined;
        chrome = {
          kind: 'prior_insight',
          kindLabel: labels.kinds.prior_insight,
          title: recordTitle(record),
          body: (
            <InsightDetail
              record={record}
              decisions={informedDecisions(document, record)}
              renderText={renderText}
              onOpenSource={sourcePaper && onOpenPaper
                ? () => { onOpenPaper(sourcePaper.doi, analysis, record.canonicalPath); }
                : undefined}
              onOpenDecision={openDecision}
            />
          ),
        };
        break;
      }
    }
  }

  if (!chrome) {
    if (fallback == null) return null;
    return (
      <DetailDialog {...dialog} kind="analysis" title={labels.notFound} closeLabel={labels.close}>
        {fallback}
      </DetailDialog>
    );
  }
  return (
    <DetailDialog
      {...dialog}
      kind={chrome.kind}
      layout={chrome.layout}
      kindLabel={chrome.kindLabel}
      title={chrome.title}
      closeLabel={labels.closeRecord(labels.kinds[chrome.kind])}
      actions={chrome.actions}
    >
      {chrome.body}
    </DetailDialog>
  );
}

const PLACEHOLDER_OUTPUT = { canonicalPath: '' } as ResolvedOutput;
