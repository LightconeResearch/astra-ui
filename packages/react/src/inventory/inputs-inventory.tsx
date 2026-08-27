import type { ResolvedAnalysisNode, ResolvedInput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes, type Ref } from 'react';
import { recordTitle } from '../data/records.js';
import { useLabels } from '../lib/labels.js';
import { inputSourceLabel } from '../records/input-detail.js';
import { EmptyState, RecordIdentity, RecordList } from '../ui/record-list.js';
import { InventoryRecords } from './section.js';

export interface InputsInventoryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  onOpenRecord: (input: ResolvedInput, analysis: ResolvedAnalysisNode) => void;
}

/** Inputs with their declared source and type. */
export const InputsInventory = forwardRef<HTMLDivElement, InputsInventoryProps>(function InputsInventory({
  analysis,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const records = analysis.inputs;
  if (!records.length) {
    return <EmptyState {...(props as HTMLAttributes<HTMLParagraphElement>)} ref={ref as Ref<HTMLParagraphElement>} data-slot="inputs-inventory" className={className}>{labels.empty.inputs}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="input" className={className}>
      <RecordList
        label={labels.sections.inputs}
        columnTemplate="minmax(14rem, 1.1fr) minmax(12rem, 1fr) 6.875rem 1.5rem"
        columns={[
          { label: 'Input', className: 'astra-record-list__primary' },
          { label: 'Source', className: 'astra-record-list__source' },
          { label: 'Type', className: 'astra-record-list__secondary' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.canonicalPath,
          accessibleLabel: recordTitle(record),
          onOpen: () => { onOpenRecord(record, analysis); },
          cells: [
            <RecordIdentity kind="input" title={recordTitle(record)} />,
            <code title={inputSourceLabel(record)}>{inputSourceLabel(record)}</code>,
            <span className="astra-record-list__tag">{record.type}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </InventoryRecords>
  );
});
