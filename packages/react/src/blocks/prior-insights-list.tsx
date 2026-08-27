import type { ResolvedAnalysisNode, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { countLabel, recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { EmptyState, RecordIdentity, RecordList } from '../primitives/record-list.js';
import { InventoryRecords } from './section.js';

export interface PriorInsightsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  onOpenRecord: (insight: ResolvedInsight, analysis: ResolvedAnalysisNode) => void;
}

/** Prior insights with their claim and source count. */
export const PriorInsightsList = forwardRef<HTMLDivElement, PriorInsightsListProps>(function PriorInsightsList({
  analysis,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const records = analysis.prior_insights;
  if (!records.length) {
    return <EmptyState {...props} ref={ref} data-slot="prior-insights-list" className={className}>{labels.empty.prior_insights}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="prior_insight" className={className}>
      <RecordList
        label={labels.sections.prior_insights}
        columnTemplate="minmax(18rem, 1fr) 7rem 1.5rem"
        columns={[
          { label: 'Prior insight', className: 'astra-record-list__primary' },
          { label: 'Evidence', className: 'astra-record-list__count astra-record-list__secondary' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.canonicalPath,
          accessibleLabel: `${recordTitle(record)}: ${record.claim} ${countLabel(record.evidence.length, 'source')}`,
          onOpen: () => { onOpenRecord(record, analysis); },
          cells: [
            <RecordIdentity
              kind="prior_insight"
              title={record.claim}
              subtitle={record.label ? record.id : undefined}
            />,
            <span>{countLabel(record.evidence.length, 'source')}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </InventoryRecords>
  );
});
