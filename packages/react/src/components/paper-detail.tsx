import type { ResolvedDecision, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, useCallback, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { countLabel, recordTitle } from '../model/records.js';
import { decisionInsightPaths } from '../model/relations.js';
import { paperEvidence, type InventoryPaper, type InventoryPaperMetadata, type PaperFocusEvidence } from '../model/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading } from '../primitives/detail-layout.js';
import { DetailDialog, DialogAction, type DetailDialogProps } from '../primitives/dialog.js';
import { surfaceGlyph } from '../primitives/kind.js';
import type { TextRenderer } from '../primitives/prose.js';
import { InsightTrigger } from './insight-trigger.js';

export interface PaperRenderOptions {
  focusEvidence?: PaperFocusEvidence | undefined;
}

/** Host slot for PDF, HTML, or any other paper presentation. */
export type PaperRenderer = (paper: InventoryPaper, options: PaperRenderOptions) => ReactNode;

export interface PaperDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: InventoryPaper;
  /** Fetch state for this DOI, if the host tracks it. */
  metadata?: Pick<InventoryPaperMetadata, 'status' | 'error'> | undefined;
  /** Insight whose first quoted passage is focused initially. */
  focusInsight?: ResolvedInsight | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  /** Notify the host to fetch this DOI; refreshed metadata returns through props. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  onOpenInsight?: ((insight: ResolvedInsight) => void) | undefined;
  onOpenDecision?: ((decision: ResolvedDecision) => void) | undefined;
}

function initialFocus(paper: InventoryPaper, focusInsight: ResolvedInsight | undefined): PaperFocusEvidence | undefined {
  if (!focusInsight) return undefined;
  const evidence = paperEvidence(focusInsight, paper.doi)[0];
  return evidence?.quote ? { key: `${focusInsight.canonicalPath}-source`, insight: focusInsight, evidence } : undefined;
}

/** Host-rendered paper content beside the insights and decisions it supports. */
export const PaperDetail = forwardRef<HTMLDivElement, PaperDetailProps>(function PaperDetail({
  record: paper,
  metadata,
  focusInsight,
  renderText,
  renderPaper,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined);
  const [override, setOverride] = useState<PaperFocusEvidence | undefined>(undefined);
  const [decisionFilter, setDecisionFilter] = useState<string | undefined>(undefined);
  const key = `${paper.doi}|${focusInsight?.canonicalPath ?? ''}`;
  if (focusKey !== key) {
    setFocusKey(key);
    setOverride(undefined);
    setDecisionFilter(undefined);
  }
  // One object per request, kept across unrelated re-renders, with a key
  // that changes on every locate click so a repeat of the same passage is
  // still a new request to the host.
  const focusEvidence = useMemo(() => override ?? initialFocus(paper, focusInsight), [override, paper, focusInsight]);
  const sequence = useRef(0);
  const locate = useCallback((insight: ResolvedInsight, evidence: PaperFocusEvidence['evidence']) => {
    sequence.current += 1;
    setOverride({ key: `${insight.canonicalPath}-${sequence.current}`, insight, evidence });
  }, []);
  const canRender = Boolean(paper.pdfUrl && renderPaper);
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
        {canRender && renderPaper ? (
          <>{renderPaper(paper, { focusEvidence })}</>
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
                  ? 'This host has not supplied an embedded paper renderer.'
                  : 'Follow the DOI for the published version.'}
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
                      {canRender ? (
                        <div>
                          {evidence.map((source, index) => (
                            <button
                              key={`${insight.canonicalPath}-${index}`}
                              type="button"
                              className="astra-paper-insight__locate"
                              onClick={() => { locate(insight, source); }}
                              aria-label={`Locate source passage ${index + 1} in paper`}
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

export interface PaperDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<PaperDetailProps, 'className'> {}

/** Header action linking to the paper's hosted content, when there is one. */
export interface PaperDialogActionsProps {
  record: InventoryPaper;
}

export function PaperDialogActions({ record: paper }: PaperDialogActionsProps) {
  const labels = useLabels();
  if (!paper.pdfUrl) return null;
  return (
    <DialogAction asChild>
      <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
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
  renderPaper,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
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
      actions={<PaperDialogActions record={paper} />}
    >
      <PaperDetail
        record={paper}
        metadata={metadata}
        focusInsight={focusInsight}
        renderText={renderText}
        renderPaper={renderPaper}
        onFetchPaper={onFetchPaper}
        onOpenInsight={onOpenInsight}
        onOpenDecision={onOpenDecision}
      />
    </DetailDialog>
  );
}
