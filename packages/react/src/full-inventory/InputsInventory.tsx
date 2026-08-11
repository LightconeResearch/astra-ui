import { InventoryProse } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryDetailProse,
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import {
  getInventoryScope,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  type InventoryModel,
} from './model.js';
import type { InventoryInputRecord, InventoryScope } from '../types.js';

interface InputsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenInput: (input: InventoryInputRecord, scope: InventoryScope) => void;
}

function sourceLabel(record: InventoryInputRecord): string {
  const alias = record.relations.find((relation) => relation.kind === 'aliases');
  return record.source ?? record.reference ?? alias?.targetRecordId ?? 'Source not declared';
}

export function InputDialog({
  record,
  scope,
  onBack,
  onClose,
}: {
  record: InventoryInputRecord;
  scope: InventoryScope;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  return (
    <InventoryDetailDialog
      kind="input"
      eyebrow={`Input · ${record.inputType ?? 'data'} · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.localId : undefined}
      onBack={onBack}
      closeLabel="Close input details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-record-detail__layout--single">
        <InventoryDetailMain>
          {record.description ? (
            <InventoryDetailProse label="Description">
              <InventoryProse text={record.description} />
            </InventoryDetailProse>
          ) : null}
          <section className="inventory-input-source">
            <h4>{record.relations.some((relation) => relation.kind === 'aliases') ? 'Resolved from' : 'Source'}</h4>
            <code>{sourceLabel(record)}</code>
          </section>
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export function InputsInventory({ model, scopeId, onOpenInput }: InputsInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const records = scope ? inventoryRecordsOfKind(scope, 'input', model) : [];

  if (!scope || !records.length) {
    return <InventoryEmptyState>No inputs are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--inputs">
      <InventoryRecordList
        ariaLabel="Inputs"
        columnTemplate="minmax(14rem, 1.2fr) minmax(12rem, 1fr) 1.5rem"
        columns={[
          { label: 'Input', className: 'inventory-record-list__primary' },
          { label: 'Source', className: 'inventory-record-list__source' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.id,
          accessibleLabel: inventoryRecordTitle(record),
          onOpen: () => onOpenInput(record, scope),
          cells: [
            <InventoryRecordIdentity kind="input" title={inventoryRecordTitle(record)} />,
            <code title={sourceLabel(record)}>{sourceLabel(record)}</code>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
