import type { ResolvedInsight } from '@astra-spec/sdk';
import { Fragment, forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { doiHref } from '../model/doi.js';
import { findingLiterature, type FindingEvidenceLink } from '../model/relations.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { DetailLayout, DetailMain } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';
import { RelationList } from '../primitives/relation-list.js';
import type { OpenRecordHandler } from './relation-items.js';

export interface FindingDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedInsight;
  /** Artifact-backed evidence resolved to outputs; see `findingEvidence()`. */
  evidence: FindingEvidenceLink[];
  renderText?: TextRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
}

/** Notes, the supporting results a finding cites, and its literature sources. */
export const FindingDetail = forwardRef<HTMLDivElement, FindingDetailProps>(function FindingDetail({
  record,
  evidence,
  renderText,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const literature = findingLiterature(record);
  return (
    <DetailLayout data-slot="finding-detail" {...props} ref={ref} layout="single" className={cn('astra-finding-detail', className)}>
      <DetailMain>
        {record.notes ? (
          <section className="astra-finding-detail__notes">
            <h4>Notes</h4>
            <div><Prose text={record.notes} field="notes" renderText={renderText} /></div>
          </section>
        ) : null}
        <RelationList
          className="astra-finding-detail__results"
          title="Supporting results"
          empty="No supporting results are linked to this finding."
          items={evidence.map((item, index) => {
            const title = item.output
              ? recordTitle(item.output)
              : item.evidence.artifact ?? `Result ${index + 1}`;
            const { output, analysis } = item;
            return {
              key: `${item.evidence.resolvedOutputPath ?? item.evidence.artifact ?? 'result'}-${index}`,
              label: title,
              identifier: output?.canonicalPath ?? item.evidence.artifact,
              detail: output?.type ?? 'Unavailable',
              kind: 'output' as const,
              accessibleLabel: output ? `View supporting result: ${title}` : undefined,
              onOpen: output && analysis && onOpenRecord ? () => { onOpenRecord(output, analysis); } : undefined,
            };
          })}
        />
        {literature.map((source, index) => {
          const doi = source.doi ?? '';
          const location = source.location?.page ? ` · page ${source.location.page}` : '';
          return (
            <Fragment key={`${doi}-${index}`}>
              <section className="astra-insight-detail__paper astra-paper-doi">
                <h4>Source paper</h4>
                <a href={doiHref(doi)} target="_blank" rel="noreferrer">{doi}{location} ↗</a>
              </section>
              {source.quote ? (
                <section className="astra-insight-detail__source-quote">
                  <h4>Source passage</h4>
                  <blockquote><Prose text={source.quote.exact} field="quote" renderText={renderText} /></blockquote>
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </DetailMain>
    </DetailLayout>
  );
});

export interface FindingDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<FindingDetailProps, 'className'> {}

export function FindingDialog({ record, evidence, renderText, onOpenRecord, ...dialog }: FindingDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="finding"
      kindLabel={labels.kinds.finding}
      title={record.claim}
      closeLabel={labels.closeRecord(labels.kinds.finding)}
    >
      <FindingDetail record={record} evidence={evidence} renderText={renderText} onOpenRecord={onOpenRecord} />
    </DetailDialog>
  );
}
