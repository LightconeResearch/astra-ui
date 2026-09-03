import type { ResolvedAnalysisNode, ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { EmptyState, RecordList } from '../primitives/record-list.js';
import { InventoryRecords } from './section.js';

export interface FindingsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  onOpenRecord: (finding: ResolvedInsight, analysis: ResolvedAnalysisNode) => void;
}

function evidenceLabel(count: number): string {
  return `${count} evidence ${count === 1 ? 'item' : 'items'}`;
}

/** Findings with their claim and evidence count. */
export const FindingsList = forwardRef<HTMLDivElement, FindingsListProps>(function FindingsList({
  analysis,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const records = analysis.findings;
  if (!records.length) {
    return <EmptyState data-slot="findings-list" {...props} ref={ref} className={className}>{labels.empty.findings}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="finding" className={className}>
      <RecordList
        label={labels.sections.findings}
        columnTemplate="minmax(18rem, 1fr) 7rem 1.5rem"
        columns={[
          { label: 'Finding', className: 'astra-record-list__primary' },
          { label: 'Evidence', className: 'astra-record-list__count astra-record-list__secondary' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={records.map((record) => {
          const count = record.evidence.length;
          return {
            key: record.canonicalPath,
            accessibleLabel: `${recordTitle(record)}: ${record.claim} ${evidenceLabel(count)}`,
            onOpen: () => { onOpenRecord(record, analysis); },
              cells: [
              <span className="astra-record-list__name" data-variant="claim">
                <span className="astra-record-list__glyph" aria-hidden="true">●</span>
                <span>
                  {record.label ? <small>{record.label}</small> : null}
                  <strong>{record.claim}</strong>
                </span>
              </span>,
              <span>{evidenceLabel(count)}</span>,
              <span aria-hidden="true">→</span>,
            ],
          };
        })}
      />
    </InventoryRecords>
  );
});
