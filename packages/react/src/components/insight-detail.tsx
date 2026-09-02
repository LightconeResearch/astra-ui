import type { ResolvedDecision, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { doiHref } from '../model/doi.js';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { DetailLayout, DetailMain, DetailSection } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';
import { RelationList } from '../primitives/relation-list.js';
import { relationItemForRecord } from './relation-items.js';

/**
 * The literature evidence an insight is presented against: the first entry
 * with a DOI. A quote without a DOI names no paper to open, so it is skipped;
 * the passage shown and the paper opened always belong to this one entry.
 */
export function primaryLiteratureEvidence(insight: ResolvedInsight) {
  return insight.evidence.find((evidence) => Boolean(evidence.doi));
}

export interface InsightDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedInsight;
  /** Decisions that cite this insight; see `informedDecisions()`. */
  decisions: ResolvedDecision[];
  renderText?: TextRenderer | undefined;
  /** Opens the source paper (with this insight focused) when the host can show it. */
  onOpenSource?: (() => void) | undefined;
  onOpenDecision?: ((decision: ResolvedDecision) => void) | undefined;
}

/** Claim, source passage, notes, and the decisions an insight informs. */
export const InsightDetail = forwardRef<HTMLDivElement, InsightDetailProps>(function InsightDetail({
  record: insight,
  decisions,
  renderText,
  onOpenSource,
  onOpenDecision,
  className,
  ...props
}, ref) {
  const source = primaryLiteratureEvidence(insight);
  return (
    <DetailLayout data-slot="insight-detail" {...props} ref={ref} layout="single" className={cn('astra-insight-detail', className)}>
      <DetailMain>
        {insight.claim ? (
          <DetailSection label="Claim" heading="section">
            <Prose text={insight.claim} field="claim" renderText={renderText} />
          </DetailSection>
        ) : null}
        {source?.quote ? (
          <figure className="astra-insight-detail__source-quote">
            <blockquote><Prose text={source.quote.exact} field="quote" renderText={renderText} /></blockquote>
            {source.doi && onOpenSource ? (
              <figcaption>
                <button type="button" className="astra-insight-detail__open-source" onClick={onOpenSource}>
                  Locate passage in paper <span aria-hidden="true">→</span>
                </button>
              </figcaption>
            ) : null}
          </figure>
        ) : source?.doi ? (
          // Evidence with a DOI but no quote still needs a way to the paper.
          onOpenSource ? (
            <button type="button" className="astra-insight-detail__open-source" onClick={onOpenSource}>
              Open source paper <span aria-hidden="true">→</span>
            </button>
          ) : (
            <a className="astra-insight-detail__open-source" href={doiHref(source.doi)} target="_blank" rel="noreferrer">
              Open source paper <span aria-hidden="true">↗</span>
            </a>
          )
        ) : null}
        {insight.notes ? (
          <section className="astra-insight-detail__notes">
            <h4>Notes</h4>
            <div><Prose text={insight.notes} field="notes" renderText={renderText} /></div>
          </section>
        ) : null}
        <RelationList
          className="astra-detail__relations"
          title="Informs decisions"
          items={decisions.map((decision) => relationItemForRecord(
            decision,
            undefined,
            undefined,
            { onOpen: onOpenDecision ? () => { onOpenDecision(decision); } : undefined },
          ))}
          empty="No decisions cite this insight."
        />
      </DetailMain>
    </DetailLayout>
  );
});

export interface InsightDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<InsightDetailProps, 'className'> {}

export function InsightDialog({ record, decisions, renderText, onOpenSource, onOpenDecision, ...dialog }: InsightDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="prior_insight"
      kindLabel={labels.kinds.prior_insight}
      title={recordTitle(record)}
      closeLabel={labels.closeRecord(labels.kinds.prior_insight)}
    >
      <InsightDetail
        record={record}
        decisions={decisions}
        renderText={renderText}
        onOpenSource={onOpenSource}
        onOpenDecision={onOpenDecision}
      />
    </DetailDialog>
  );
}
