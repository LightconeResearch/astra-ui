import { useEffect, useState } from 'react';
import type {
  ResolvedAnalysisNode,
  ResolvedDecision,
  ResolvedInsight,
} from '@astra-spec/sdk';
import { InventoryProse } from './InventoryProse.js';
import type { TextRenderer } from './InventoryProse.js';
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
import { analysisTitle, recordTitle, selectedOptionLabel } from './inventory-data.js';

export interface DecisionsInventoryProps {
  analysis: ResolvedAnalysisNode;
  tagLabels?: Readonly<Record<string, string>> | undefined;
  onOpenDecision: (decision: ResolvedDecision, analysis: ResolvedAnalysisNode) => void;
}

function tagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag]
    ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}

export function DecisionDialog({
  record,
  analysis,
  insights,
  renderText,
  onOpenInsight,
  onBack,
  onClose,
}: DecisionDialogProps) {
  const options = record.options;
  return (
    <InventoryDetailDialog
      kind="decision"
      eyebrow={`Decision · ${analysisTitle(analysis)}`}
      title={recordTitle(record)}
      identifier={record.canonicalPath}
      onBack={onBack}
      closeLabel="Close decision details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-record-detail__layout--single">
        <InventoryDetailMain>
          {record.rationale ? (
            <InventoryDetailProse
              label="Rationale"
              className="inventory-record-detail__prose--section-heading"
            >
              <InventoryProse text={record.rationale} renderText={renderText} />
            </InventoryDetailProse>
          ) : null}
          <section className="inventory-decision-options" aria-labelledby="inventory-decision-options-title">
            <h4 id="inventory-decision-options-title">Options</h4>
            <ul>
              {options.map((option) => {
                const selected = option.id === record.selectedOptionId;
                return (
                  <li key={option.id} className={selected ? 'is-selected' : undefined}>
                    <span className="inventory-decision-options__marker" aria-hidden="true">
                      {selected ? '●' : '○'}
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                      <code>{option.id}</code>
                    </span>
                    {selected ? <small>Selected</small> : null}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="inventory-insight-list">
            <InventoryCountHeading title="Insights that informed this" count={insights.length} />
            {insights.length ? (
              <ul className="inventory-decision-insights">
                {insights.map((insight) => (
                  <li key={insight.canonicalPath}>
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

export interface DecisionDialogProps {
  record: ResolvedDecision;
  analysis: ResolvedAnalysisNode;
  insights: ResolvedInsight[];
  renderText?: TextRenderer | undefined;
  onOpenInsight: (insight: ResolvedInsight) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

export function DecisionsInventory({
  analysis,
  tagLabels = {},
  onOpenDecision,
}: DecisionsInventoryProps) {
  const [tagFilter, setTagFilter] = useState('all');

  useEffect(() => {
    setTagFilter('all');
  }, [analysis.canonicalPath]);

  const records = analysis.decisions;
  const tags = [...new Set(records.flatMap((record) => record.tags ?? []))];
  const visibleRecords = tagFilter === 'all'
    ? records
    : records.filter((record) => record.tags?.includes(tagFilter));

  if (!records.length) {
    return <InventoryEmptyState>No decisions are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--decisions">
      {tags.length ? (
        <div className="inventory-record-filter" role="group" aria-label="Filter decisions by tag">
          <div className="inventory-record-filter__chips">
            <button
              type="button"
              aria-pressed={tagFilter === 'all'}
              onClick={() => setTagFilter('all')}
            >
              All · {records.length}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tagFilter === tag}
                onClick={() => setTagFilter(tag)}
              >
                {tagLabel(tag, tagLabels)} · {records.filter((record) => record.tags?.includes(tag)).length}
              </button>
            ))}
          </div>
          <span>{visibleRecords.length} {visibleRecords.length === 1 ? 'decision' : 'decisions'}</span>
        </div>
      ) : null}
      <InventoryRecordList
        ariaLabel="Decisions"
        columnTemplate="minmax(14rem, 1.1fr) minmax(12rem, 1fr) 6.875rem 1.5rem"
        columns={[
          { label: 'Decision', className: 'inventory-record-list__primary' },
          { label: 'Selected option', className: 'inventory-record-list__selection' },
          { label: 'Tag', className: 'inventory-record-list__secondary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={visibleRecords.map((record) => ({
          key: record.canonicalPath,
          accessibleLabel: `${recordTitle(record)}, selected option ${selectedOptionLabel(record)}`,
          onOpen: () => onOpenDecision(record, analysis),
          cells: [
            <InventoryRecordIdentity kind="decision" title={recordTitle(record)} />,
            <span className="inventory-record-list__selected">{selectedOptionLabel(record)}</span>,
            <span className="inventory-record-list__tag">
              {record.tags?.[0] ? tagLabel(record.tags[0], tagLabels) : '—'}
            </span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
