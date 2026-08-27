import type { ResolvedAnalysisNode, ResolvedInsight } from '@astra-spec/sdk';
import {
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { recordTitle } from './inventory-data.js';

export interface PriorInsightsInventoryProps {
  analysis: ResolvedAnalysisNode;
  onOpenInsight: (insight: ResolvedInsight, analysis: ResolvedAnalysisNode) => void;
}

function evidenceLabel(count: number): string {
  return `${count} ${count === 1 ? 'source' : 'sources'}`;
}

export function PriorInsightsInventory({
  analysis,
  onOpenInsight,
}: PriorInsightsInventoryProps) {
  const records = analysis.prior_insights;

  if (!records.length) {
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
          key: record.canonicalPath,
          accessibleLabel: `${recordTitle(record)}: ${record.claim} ${evidenceLabel(record.evidence.length)}`,
          onOpen: () => onOpenInsight(record, analysis),
          cells: [
            <InventoryRecordIdentity
              kind="prior_insight"
              title={record.claim}
              subtitle={record.label ? record.id : undefined}
            />,
            <span>{evidenceLabel(record.evidence.length)}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
