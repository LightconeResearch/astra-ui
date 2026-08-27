import type { ResolvedDecision, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, useCallback, useState, type HTMLAttributes, type ReactNode } from 'react';
import { doiHref } from '../data/doi.js';
import { countLabel } from '../data/records.js';
import { paperEvidence, type InventoryPaper, type InventoryPaperMetadata, type PaperFocusEvidence } from '../data/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading } from '../ui/detail-layout.js';
import { DetailDialog, DialogAction, type DetailDialogProps } from '../ui/dialog.js';
import { Prose, type TextRenderer } from '../ui/prose.js';
import { RelationList } from '../ui/relation-list.js';
import { InsightTrigger } from './insight-trigger.js';
import { relationItemForRecord } from './relation-items.js';

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
  return evidence?.quote ? { insight: focusInsight, evidence } : undefined;
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
  const key = `${paper.doi}|${focusInsight?.canonicalPath ?? ''}`;
  if (focusKey !== key) {
    setFocusKey(key);
    setOverride(undefined);
  }
  const focusEvidence = override ?? initialFocus(paper, focusInsight);
  const locate = useCallback((insight: ResolvedInsight, evidence: PaperFocusEvidence['evidence']) => {
    setOverride({ insight, evidence });
  }, []);
  const canRender = Boolean(paper.pdfUrl && renderPaper);
  const fetching = metadata?.status === 'fetching';

  return (
    <div {...props} ref={ref} data-slot="paper-detail" className={cn('astra-paper-detail__layout', className)}>
      <div className="astra-paper-detail__artifact">
        {canRender && renderPaper ? (
          <>{renderPaper(paper, { focusEvidence })}</>
        ) : (
          <div className="astra-paper-detail__unavailable" {...(fetching ? { 'aria-busy': true } : {})}>
            {!paper.pdfUrl && onFetchPaper ? (
              <>
                <p>{metadata?.status === 'error'
                  ? (metadata.error ?? 'The paper could not be fetched.')
                  : 'No paper content is available from this host.'}</p>
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
        <section className="astra-paper-doi">
          <h4>DOI</h4>
          <a href={doiHref(paper.doi)} target="_blank" rel="noreferrer">
            {paper.doi} ↗
          </a>
        </section>
        <section className="astra-insight-list">
          <CountHeading title="Insights from this paper" count={paper.insights.length} />
          <ul className="astra-evidence astra-paper-detail__insights">
            {paper.insights.map((insight) => {
              const evidence = paperEvidence(insight, paper.doi);
              return (
                <li key={insight.canonicalPath} className="astra-evidence__item astra-paper-insight">
                  <InsightTrigger insight={insight} tag={null} onOpen={() => onOpenInsight?.(insight)} />
                  <div className="astra-paper-insight__claim">
                    <Prose text={insight.claim} field="claim" renderText={renderText} />
                  </div>
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
        <RelationList
          className="astra-detail__relations"
          title="Informs decisions"
          items={paper.decisions.map((decision) => relationItemForRecord(
            decision,
            undefined,
            undefined,
            { onOpen: onOpenDecision ? () => { onOpenDecision(decision); } : undefined },
          ))}
          empty="No decisions in this analysis cite insights from this paper."
        />
      </aside>
    </div>
  );
});

export interface PaperDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<PaperDetailProps, 'className'> {}

/** Header action linking to the paper's hosted content, when there is one. */
export function PaperDialogActions({ record: paper }: { record: InventoryPaper }) {
  const labels = useLabels();
  if (!paper.pdfUrl) return null;
  return (
    <DialogAction asChild>
      <a href={paper.pdfUrl} target="_blank" rel="noreferrer">{labels.actions.openPaper}</a>
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
