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
import type { InventoryRecord, InventoryScope } from './types.js';

interface InputsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenInput: (input: InventoryRecord, scope: InventoryScope) => void;
}

function sourceLabel(record: InventoryRecord): string {
  return record.source ?? record.from ?? 'Source not declared';
}

export function InputDialog({
  record,
  scope,
  onBack,
  onClose,
}: {
  record: InventoryRecord;
  scope: InventoryScope;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  return (
    <InventoryDetailDialog
      kind="input"
      eyebrow={`Input · ${record.type ?? 'data'} · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.id : undefined}
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
            <h4>{record.from ? 'Resolved from' : 'Source'}</h4>
            <code>{sourceLabel(record)}</code>
          </section>
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export function InputsInventory({ model, scopeId, onOpenInput }: InputsInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const records = scope ? inventoryRecordsOfKind(scope, 'input') : [];

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
          key: record.path,
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
