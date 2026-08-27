import type { ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../data/records.js';
import type { FindingEvidenceLink } from '../data/relations.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { DetailLayout, DetailMain } from '../ui/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../ui/dialog.js';
import { Prose, type TextRenderer } from '../ui/prose.js';
import { RelationList } from '../ui/relation-list.js';
import type { OpenRecordHandler } from './relation-items.js';

export interface FindingDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedInsight;
  /** Artifact-backed evidence resolved to outputs; see `findingEvidence()`. */
  evidence: FindingEvidenceLink[];
  renderText?: TextRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
}

/** Notes and the supporting results a finding cites. */
export const FindingDetail = forwardRef<HTMLDivElement, FindingDetailProps>(function FindingDetail({
  record,
  evidence,
  renderText,
  onOpenRecord,
  className,
  ...props
}, ref) {
  return (
    <DetailLayout {...props} ref={ref} layout="single" className={cn('astra-finding-detail', className)} data-slot="finding-detail">
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
