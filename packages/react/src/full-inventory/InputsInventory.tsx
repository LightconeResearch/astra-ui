import type { ResolvedAnalysisNode, ResolvedInput } from '@astra-spec/sdk';
import { InventoryProse } from './InventoryProse.js';
import type { TextRenderer } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryDetailProse,
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { analysisTitle, recordTitle } from './inventory-data.js';

export interface InputsInventoryProps {
  analysis: ResolvedAnalysisNode;
  onOpenInput: (input: ResolvedInput, analysis: ResolvedAnalysisNode) => void;
}

function sourceLabel(record: ResolvedInput): string {
  return record.source ?? record.ref ?? record.resolvedFrom ?? 'Source not declared';
}

export function InputDialog({
  record,
  analysis,
  renderText,
  onBack,
  onClose,
}: InputDialogProps) {
  const source = sourceLabel(record);

  return (
    <InventoryDetailDialog
      className="inventory-detail-dialog--input"
      kind="input"
      eyebrow={`Input · ${record.type} · ${analysisTitle(analysis)}`}
      title={recordTitle(record)}
      identifier={record.label ? record.id : undefined}
      onBack={onBack}
      closeLabel="Close input details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-record-detail__layout--single">
        <InventoryDetailMain>
          {record.description ? (
            <InventoryDetailProse
              label="Description"
              className="inventory-record-detail__prose--section-heading"
            >
              <InventoryProse text={record.description} renderText={renderText} />
            </InventoryDetailProse>
          ) : null}
          <section className="inventory-input-source">
            <h4>{record.resolvedFrom ? 'Resolved from' : 'Source'}</h4>
            <code tabIndex={0} title={source}>{source}</code>
          </section>
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export interface InputDialogProps {
  record: ResolvedInput;
  analysis: ResolvedAnalysisNode;
  renderText?: TextRenderer | undefined;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

export function InputsInventory({ analysis, onOpenInput }: InputsInventoryProps) {
  const records = analysis.inputs;

  if (!records.length) {
    return <InventoryEmptyState>No inputs are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--inputs">
      <InventoryRecordList
        ariaLabel="Inputs"
        columnTemplate="minmax(14rem, 1.1fr) minmax(12rem, 1fr) 6.875rem 1.5rem"
        columns={[
          { label: 'Input', className: 'inventory-record-list__primary' },
          { label: 'Source', className: 'inventory-record-list__source' },
          { label: 'Type', className: 'inventory-record-list__secondary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.canonicalPath,
          accessibleLabel: recordTitle(record),
          onOpen: () => onOpenInput(record, analysis),
          cells: [
            <InventoryRecordIdentity kind="input" title={recordTitle(record)} />,
            <code title={sourceLabel(record)}>{sourceLabel(record)}</code>,
            <span className="inventory-record-list__tag">{record.type}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
