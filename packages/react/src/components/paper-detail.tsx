import type { ResolvedDecision, ResolvedEvidence, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, useCallback, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { doiHref } from '../model/doi.js';
import { countLabel, recordTitle } from '../model/records.js';
import { decisionInsightPaths } from '../model/relations.js';
import { paperEvidence, type InventoryPaper, type InventoryPaperMetadata } from '../model/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading } from '../primitives/detail-layout.js';
import { DetailDialog, DialogAction, type DetailDialogProps } from '../primitives/dialog.js';
import { surfaceGlyph } from '../primitives/kind.js';
import type { TextRenderer } from '../primitives/prose.js';
import { InsightTrigger } from './insight-trigger.js';
import { PaperPdfViewer, type PdfPassage } from './paper-pdf-viewer.js';
import type { PdfJsLoader } from './pdf-runtime.js';

export type OpenPaperFileHandler = (paper: InventoryPaper) => void | Promise<void>;

export interface PaperDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: InventoryPaper;
  /** Fetch state for this DOI, if the host tracks it. */
  metadata?: Pick<InventoryPaperMetadata, 'status' | 'error'> | undefined;
  /** Insight whose first quoted passage is located initially. */
  focusInsight?: ResolvedInsight | undefined;
  renderText?: TextRenderer | undefined;
  /** Supplies pdf.js; with it and a `pdfUrl`, the paper is read in place and its passages located. */
  loadPdfJs?: PdfJsLoader | undefined;
  /** Notify the host to fetch this DOI; refreshed metadata returns through props. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  onOpenInsight?: ((insight: ResolvedInsight) => void) | undefined;
  onOpenDecision?: ((decision: ResolvedDecision) => void) | undefined;
}

function passageFor(key: string, evidence: ResolvedEvidence): PdfPassage {
  return { key, quote: evidence.quote?.exact, page: evidence.location?.page };
}

function initialPassage(paper: InventoryPaper, focusInsight: ResolvedInsight | undefined): PdfPassage | undefined {
  const evidence = focusInsight ? paperEvidence(focusInsight, paper.doi)[0] : undefined;
  return focusInsight && evidence ? passageFor(`${focusInsight.canonicalPath}-source`, evidence) : undefined;
}

/** PDF paper content beside the insights and decisions it supports. */
export const PaperDetail = forwardRef<HTMLDivElement, PaperDetailProps>(function PaperDetail({
  record: paper,
  metadata,
  focusInsight,
  renderText,
  loadPdfJs,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined);
  const [override, setOverride] = useState<PdfPassage | undefined>(undefined);
  const [decisionFilter, setDecisionFilter] = useState<string | undefined>(undefined);
  // Keyed by URL so a failure for one paper never outlives it inside a persistent dialog.
  const [failedPdfUrl, setFailedPdfUrl] = useState<string | undefined>(undefined);
  const key = `${paper.doi}|${focusInsight?.canonicalPath ?? ''}`;
  if (focusKey !== key) {
    setFocusKey(key);
    setOverride(undefined);
    setDecisionFilter(undefined);
  }
  // One passage object per request, kept across unrelated re-renders, with a
  // key that changes on every locate click so repeating a passage is still a
  // new request to the viewer.
  const passage = useMemo(() => override ?? initialPassage(paper, focusInsight), [override, paper, focusInsight]);
  const sequence = useRef(0);
  const canLocate = Boolean(paper.pdfUrl && loadPdfJs) && failedPdfUrl !== paper.pdfUrl;
  const locate = useCallback((insight: ResolvedInsight, evidence: ResolvedEvidence) => {
    sequence.current += 1;
    setOverride(passageFor(`${insight.canonicalPath}-${sequence.current}`, evidence));
  }, []);
  const fetching = metadata?.status === 'fetching';
  const filterDecision = paper.decisions.find((decision) => decision.canonicalPath === decisionFilter);
  const visibleInsights = useMemo(() => {
    if (!filterDecision) return paper.insights;
    const cited = new Set(decisionInsightPaths(filterDecision));
    return paper.insights.filter((insight) => cited.has(insight.canonicalPath));
  }, [paper, filterDecision]);

  return (
    <div data-slot="paper-detail" {...props} ref={ref} className={cn('astra-paper-detail__layout', className)}>
      <div className="astra-paper-detail__artifact">
        {paper.pdfUrl && loadPdfJs ? (
          <PaperPdfViewer
            pdfUrl={paper.pdfUrl}
            title={paper.title}
            passage={passage}
            loadPdfJs={loadPdfJs}
            onLoadStateChange={(state) => { setFailedPdfUrl(state === 'error' ? paper.pdfUrl : undefined); }}
          />
        ) : (
          <div className="astra-paper-detail__unavailable" {...(fetching ? { 'aria-busy': true } : {})}>
            {!paper.pdfUrl && onFetchPaper ? (
              <>
                <p {...(metadata?.status === 'error' ? { role: 'alert' } : {})}>
                  {metadata?.status === 'error'
                    ? (metadata.error ?? 'The paper could not be fetched.')
                    : 'No paper content is available from this host.'}
                </p>
                <button type="button" disabled={fetching} onClick={() => { onFetchPaper(paper.doi); }}>
                  {labels.actions.fetchPaper}
                </button>
              </>
            ) : (
              <p>
                {paper.pdfUrl
                  ? labels.pdf.unavailable
                  : <>Follow the <a href={doiHref(paper.doi)} target="_blank" rel="noreferrer">DOI</a> for the published version.</>}
              </p>
            )}
          </div>
        )}
      </div>
      <aside className="astra-paper-detail__rail" aria-label="Paper insights and decisions">
        <section className="astra-paper-decisions">
          <CountHeading title="Informs decisions" count={paper.decisions.length} />
          {paper.decisions.length ? (
            <div
              className="astra-paper-decisions__filters"
              role="group"
              aria-label="Filter insights by decision"
            >
              {paper.decisions.map((decision) => {
                const active = decision.canonicalPath === decisionFilter;
                return (
                  <button
                    key={decision.canonicalPath}
                    type="button"
                    className="astra-paper-decisions__filter"
                    aria-pressed={active}
                    onClick={() => {
                      setDecisionFilter(active ? undefined : decision.canonicalPath);
                    }}
                  >
                    <span aria-hidden="true">{surfaceGlyph('decision')}</span>
                    <span>{recordTitle(decision)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="astra-paper-decisions__empty">No decisions cite insights from this paper.</p>
          )}
          {filterDecision && onOpenDecision ? (
            <button
              type="button"
              className="astra-paper-decisions__open"
              onClick={() => { onOpenDecision(filterDecision); }}
            >
              Open {recordTitle(filterDecision)} →
            </button>
          ) : null}
        </section>
        <section className="astra-insight-list">
          <CountHeading
            title={filterDecision ? `Insights for ${recordTitle(filterDecision)}` : 'Insights from this paper'}
            count={visibleInsights.length}
          />
          <ul className="astra-evidence astra-paper-detail__insights">
            {visibleInsights.map((insight) => {
              const evidence = paperEvidence(insight, paper.doi);
              return (
                <li key={insight.canonicalPath} className="astra-evidence__item astra-paper-insight">
                  <InsightTrigger
                    insight={insight}
                    variant="claim"
                    renderText={renderText}
                    onOpen={() => onOpenInsight?.(insight)}
                  />
                  {evidence.length ? (
                    <div className="astra-paper-insight__sources">
                      <span>{countLabel(evidence.length, 'passage')}</span>
                      {paper.pdfUrl && loadPdfJs ? (
                        <div>
                          {evidence.map((source, index) => (
                            // Kept focusable after a load failure so keyboard focus never drops out of the dialog.
                            <button
                              key={`${insight.canonicalPath}-${index}`}
                              type="button"
                              className="astra-paper-insight__locate"
                              aria-disabled={canLocate ? undefined : true}
                              onClick={() => { if (canLocate) locate(insight, source); }}
                              aria-label={labels.pdf.locatePassage(index + 1)}
                            >
                              {labels.actions.locate}{evidence.length > 1 ? ` ${index + 1}` : ''}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
});

export interface PaperDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<PaperDetailProps, 'className'> {
  onOpenPaperFile?: OpenPaperFileHandler | undefined;
}

/** Header action linking to the paper's hosted content, or to its DOI when there is none. */
export interface PaperDialogActionsProps {
  record: InventoryPaper;
  onOpenPaperFile?: OpenPaperFileHandler | undefined;
}

export function PaperDialogActions({ record: paper, onOpenPaperFile }: PaperDialogActionsProps) {
  const labels = useLabels();
  if (paper.pdfUrl && onOpenPaperFile) return (
    <DialogAction onClick={() => { void onOpenPaperFile(paper); }}>
      <span aria-hidden="true">↗</span>
      <span>{labels.actions.openPaper}</span>
    </DialogAction>
  );
  return (
    <DialogAction asChild>
      <a href={paper.pdfUrl ?? doiHref(paper.doi)} target="_blank" rel="noreferrer">
        <span aria-hidden="true">↗</span>
        <span>{labels.actions.openPaper}</span>
      </a>
    </DialogAction>
  );
}

export function PaperDialog({
  record: paper,
  metadata,
  focusInsight,
  renderText,
  loadPdfJs,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
  onOpenPaperFile,
  ...dialog
}: PaperDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="paper"
      layout="reader"
      kindLabel={labels.kinds.paper}
      title={paper.title}
      closeLabel={labels.closeRecord(labels.kinds.paper)}
      actions={<PaperDialogActions record={paper} onOpenPaperFile={onOpenPaperFile} />}
    >
      <PaperDetail
        record={paper}
        metadata={metadata}
        focusInsight={focusInsight}
        renderText={renderText}
        loadPdfJs={loadPdfJs}
        onFetchPaper={onFetchPaper}
        onOpenInsight={onOpenInsight}
        onOpenDecision={onOpenDecision}
      />
    </DetailDialog>
  );
}
