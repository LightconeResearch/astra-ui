import type { ResolvedAnalysisNode, ResolvedRecord } from '@astra-spec/sdk';
import type { LinkedRecord } from '../data/relations.js';
import { recordTitle } from '../data/records.js';
import type { RelationItem } from '../ui/relation-list.js';

export type OpenRecordHandler = (record: ResolvedRecord, analysis: ResolvedAnalysisNode) => void;

/** Builds a relation-list item for a record, with navigation when the caller handles it. */
export function relationItemForRecord(
  record: ResolvedRecord,
  analysis: ResolvedAnalysisNode | undefined,
  onOpen: OpenRecordHandler | undefined,
  overrides: Partial<RelationItem> = {},
): RelationItem {
  const title = recordTitle(record);
  return {
    key: record.canonicalPath,
    label: title,
    kind: record.kind,
    accessibleLabel: `View ${record.kind}: ${title}`,
    onOpen: analysis && onOpen ? () => { onOpen(record, analysis); } : undefined,
    ...overrides,
  };
}

/** Builds relation-list items for linked records; unresolved links show their path. */
export function relationItemsForLinks(links: LinkedRecord[], onOpen: OpenRecordHandler | undefined): RelationItem[] {
  return links.map((link) => (link.record
    ? relationItemForRecord(link.record, link.analysis, onOpen, { identifier: link.canonicalPath })
    : { key: link.canonicalPath, label: link.canonicalPath, identifier: link.canonicalPath }));
}
