import {
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
import type { InventoryInsightRecord, InventoryScope } from '../types.js';

interface PriorInsightsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenInsight: (insight: InventoryInsightRecord, scope: InventoryScope) => void;
}

function evidenceLabel(count: number): string {
  return `${count} ${count === 1 ? 'source' : 'sources'}`;
}

export function PriorInsightsInventory({
  model,
  scopeId,
  onOpenInsight,
}: PriorInsightsInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const records = scope ? inventoryRecordsOfKind(scope, 'prior_insight', model) : [];

  if (!scope || !records.length) {
    return <InventoryEmptyState>No prior insights are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--prior-insights">
      <InventoryRecordList
        ariaLabel="Prior insights"
        columnTemplate="minmax(18rem, 1fr) 7rem 1.5rem"
        columns={[
          { label: 'Prior insight', className: 'inventory-record-list__primary' },
          { label: 'Evidence', className: 'inventory-record-list__count inventory-record-list__secondary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.id,
          accessibleLabel: `${inventoryRecordTitle(record)}: ${record.claim ?? 'Claim unavailable'} ${evidenceLabel(record.evidence.length)}`,
          onOpen: () => onOpenInsight(record, scope),
          cells: [
            <InventoryRecordIdentity
              kind="prior_insight"
              title={record.claim ?? inventoryRecordTitle(record)}
              subtitle={record.label ? record.localId : undefined}
            />,
            <span>{evidenceLabel(record.evidence.length)}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
