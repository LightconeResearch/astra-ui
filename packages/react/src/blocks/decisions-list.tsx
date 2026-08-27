import type { ResolvedAnalysisNode, ResolvedDecision } from '@astra-spec/sdk';
import { forwardRef, useState, type HTMLAttributes } from 'react';
import { countLabel, recordTitle, selectedOptionLabel } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { EmptyState, RecordIdentity, RecordList } from '../primitives/record-list.js';
import { InventoryRecords } from './section.js';

export const ALL_TAGS = 'all';

export interface DecisionsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  /** Display names for decision tags. */
  tagLabels?: Readonly<Record<string, string>> | undefined;
  /** Active tag filter (controlled); `'all'` shows every decision. */
  tagFilter?: string | undefined;
  defaultTagFilter?: string | undefined;
  onTagFilterChange?: ((tag: string) => void) | undefined;
  onOpenRecord: (decision: ResolvedDecision, analysis: ResolvedAnalysisNode) => void;
}

export function decisionTagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag]
    ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}

/** Decisions with a tag filter and the selected option of each. */
export const DecisionsList = forwardRef<HTMLDivElement, DecisionsListProps>(function DecisionsList({
  analysis,
  tagLabels = {},
  tagFilter: controlledFilter,
  defaultTagFilter = ALL_TAGS,
  onTagFilterChange,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const [internalFilter, setInternalFilter] = useState(defaultTagFilter);
  const [lastAnalysis, setLastAnalysis] = useState(analysis.canonicalPath);
  if (lastAnalysis !== analysis.canonicalPath) {
    setLastAnalysis(analysis.canonicalPath);
    setInternalFilter(defaultTagFilter);
  }
  const tagFilter = controlledFilter ?? internalFilter;
  const setTagFilter = (tag: string) => {
    if (controlledFilter === undefined) setInternalFilter(tag);
    onTagFilterChange?.(tag);
  };

  const records = analysis.decisions;
  const tags = [...new Set(records.flatMap((record) => record.tags ?? []))];
  const counts = new Map<string, number>();
  for (const record of records) for (const tag of record.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const visibleRecords = tagFilter === ALL_TAGS
    ? records
    : records.filter((record) => record.tags?.includes(tagFilter));

  if (!records.length) {
    return <EmptyState data-slot="decisions-list" {...props} ref={ref} className={className}>{labels.empty.decisions}</EmptyState>;
  }

  return (
    <InventoryRecords {...props} ref={ref} kind="decision" className={className}>
      {tags.length ? (
        <div className="astra-inventory-filter" role="group" aria-label="Filter decisions by tag">
          <div className="astra-inventory-filter__chips">
            <button
              type="button"
              aria-pressed={tagFilter === ALL_TAGS}
              onClick={() => { setTagFilter(ALL_TAGS); }}
            >
              All · {records.length}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tagFilter === tag}
                onClick={() => { setTagFilter(tag); }}
              >
                {decisionTagLabel(tag, tagLabels)} · {counts.get(tag) ?? 0}
              </button>
            ))}
          </div>
          <span>{countLabel(visibleRecords.length, 'decision')}</span>
        </div>
      ) : null}
      <RecordList
        label={labels.sections.decisions}
        columnTemplate="minmax(14rem, 1.1fr) minmax(12rem, 1fr) 6.875rem 1.5rem"
        columns={[
          { label: 'Decision', className: 'astra-record-list__primary' },
          { label: 'Selected option', className: 'astra-record-list__selection' },
          { label: 'Tag', className: 'astra-record-list__secondary' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={visibleRecords.map((record) => ({
          key: record.canonicalPath,
          accessibleLabel: `${recordTitle(record)}, selected option ${selectedOptionLabel(record)}`,
          onOpen: () => { onOpenRecord(record, analysis); },
          cells: [
            <RecordIdentity kind="decision" title={recordTitle(record)} />,
            <span className="astra-record-list__selected">{selectedOptionLabel(record)}</span>,
            <span className="astra-record-list__tag">
              {record.tags?.[0] ? decisionTagLabel(record.tags[0], tagLabels) : '—'}
            </span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </InventoryRecords>
  );
});
