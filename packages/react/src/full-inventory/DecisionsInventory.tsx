import { useEffect, useState } from 'react';
import { InventoryProse } from './InventoryProse.js';
import { InsightDetailTrigger } from './InsightDetailDialog.js';
import {
  InventoryCountHeading,
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
  inventoryDecisionInsights,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  selectedOptionLabel,
  type InventoryModel,
} from './model.js';
import type {
  InventoryInsightRecord,
  InventoryRecord,
  InventoryScope,
} from './types.js';

interface DecisionsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  tagLabels?: Readonly<Record<string, string>> | undefined;
  onOpenDecision: (decision: InventoryRecord, scope: InventoryScope) => void;
}

function tagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag]
    ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}

export function DecisionDialog({
  record,
  scope,
  model,
  onOpenInsight,
  onBack,
  onClose,
}: {
  record: InventoryRecord;
  scope: InventoryScope;
  model: InventoryModel;
  onOpenInsight: (insight: InventoryInsightRecord) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  const options = Object.entries(record.options ?? {});
  const insights = inventoryDecisionInsights(model, scope, record);
  return (
    <InventoryDetailDialog
      eyebrow={`Decision · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.id}
      onBack={onBack}
      closeLabel="Close decision details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-record-detail__layout--single">
        <InventoryDetailMain>
          {record.rationale ? (
            <InventoryDetailProse label="Rationale">
              <InventoryProse text={record.rationale} />
            </InventoryDetailProse>
          ) : null}
          <section className="inventory-decision-options" aria-labelledby="inventory-decision-options-title">
            <h4 id="inventory-decision-options-title">Options</h4>
            <ul>
              {options.map(([id, label]) => {
                const selected = id === record.selected;
                return (
                  <li key={id} className={selected ? 'is-selected' : undefined}>
                    <span className="inventory-decision-options__marker" aria-hidden="true">
                      {selected ? '●' : '○'}
                    </span>
                    <span>
                      <strong>{label ?? id}</strong>
                      <code>{id}</code>
                    </span>
                    {selected ? <small>Selected</small> : null}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="inventory-insight-list">
            <InventoryCountHeading title="Insights" count={insights.length} />
            {insights.length ? (
              <ul className="inventory-decision-insights">
                {insights.map((insight) => (
                  <li key={insight.path}>
                    <InsightDetailTrigger
                      insight={insight}
                      variant="claim"
                      onOpen={() => onOpenInsight(insight)}
                    />
                  </li>
                ))}
              </ul>
            ) : <p>No prior insights are linked to this decision.</p>}
          </section>
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export function DecisionsInventory({
  model,
  scopeId,
  tagLabels = {},
  onOpenDecision,
}: DecisionsInventoryProps) {
  const [tagFilter, setTagFilter] = useState('all');
  const scope = getInventoryScope(model, scopeId);

  useEffect(() => {
    setTagFilter('all');
  }, [scopeId]);

  const records = scope ? inventoryRecordsOfKind(scope, 'decision') : [];
  const tags = [...new Set(records.flatMap((record) => record.tags ?? []))];
  const visibleRecords = tagFilter === 'all'
    ? records
    : records.filter((record) => record.tags?.includes(tagFilter));

  if (!scope || !records.length) {
    return <InventoryEmptyState>No decisions are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--decisions">
      {tags.length ? (
        <div className="inventory-record-filter">
          <select
            aria-label="Decision tag"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">All tags ({records.length})</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tagLabel(tag, tagLabels)} ({records.filter((record) => record.tags?.includes(tag)).length})
              </option>
            ))}
          </select>
          <span>{visibleRecords.length} {visibleRecords.length === 1 ? 'decision' : 'decisions'}</span>
        </div>
      ) : null}
      <InventoryRecordList
        ariaLabel="Decisions"
        columnTemplate="minmax(14rem, 1.4fr) minmax(12rem, 1fr) 1.5rem"
        columns={[
          { label: 'Decision', className: 'inventory-record-list__primary' },
          { label: 'Selected option', className: 'inventory-record-list__selection' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={visibleRecords.map((record) => ({
          key: record.path,
          accessibleLabel: `${inventoryRecordTitle(record)}, selected option ${selectedOptionLabel(record)}`,
          onOpen: () => onOpenDecision(record, scope),
          cells: [
            <InventoryRecordIdentity kind="decision" title={inventoryRecordTitle(record)} />,
            <span className="inventory-record-list__selected">{selectedOptionLabel(record)}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
