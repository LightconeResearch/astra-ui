import type { Analysis, Input } from '@astra-spec/sdk/reports';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { inputSourceLabel } from '../model/records.js';
import { EmptyState, RecordIdentity, RecordList } from '../primitives/record-list.js';
import { InventoryRecords } from './section.js';

export interface InputsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: Analysis;
  onOpenRecord: (input: Input, analysis: Analysis) => void;
}

/** Inputs with their declared source and type. */
export const InputsList = forwardRef<HTMLDivElement, InputsListProps>(function InputsList({
  analysis,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const records = analysis.inputs;
  if (!records.length) {
    return <EmptyState data-slot="inputs-list" {...props} ref={ref} className={className}>{labels.empty.inputs}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="input" className={className}>
      <RecordList
        label={labels.sections.inputs}
        columnTemplate="minmax(14rem, 1.1fr) minmax(12rem, 1fr) 1.5rem"
        columns={[
          { label: 'Input', className: 'astra-record-list__primary' },
          { label: 'Source', className: 'astra-record-list__source' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.ref,
          accessibleLabel: recordTitle(record),
          onOpen: () => { onOpenRecord(record, analysis); },
          cells: [
            <RecordIdentity kind="input" title={recordTitle(record)} />,
            <code title={inputSourceLabel(record)}>{inputSourceLabel(record)}</code>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </InventoryRecords>
  );
});
