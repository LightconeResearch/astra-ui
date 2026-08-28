import type { ResolvedDecision, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, useCallback, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { doiHref } from '../model/doi.js';
import { countLabel } from '../model/records.js';
import { paperEvidence, type InventoryPaper, type InventoryPaperMetadata, type PaperFocusEvidence } from '../model/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading } from '../primitives/detail-layout.js';
import { DetailDialog, DialogAction, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';
import { RelationList } from '../primitives/relation-list.js';
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
  const key = `${paper.doi}|${focusInsight?.canonicalPath ?? ''}`;
  if (focusKey !== key) {
    setFocusKey(key);
    setOverride(undefined);
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
          empty="No decisions cite insights from this paper."
        />
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
