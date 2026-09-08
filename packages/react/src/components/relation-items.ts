import type { ResolvedAnalysisNode, ResolvedRecord } from '@astra-spec/sdk';
import type { LinkedRecord } from '../model/relations.js';
import { recordTitle } from '../model/records.js';
import type { RelationItem } from '../primitives/relation-list.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

// Glue between model records and the RelationList primitive: it needs both
// `recordTitle` from model and the item shape from primitives, which no lower
// layer can see together, so it stays here beside the components that use it.

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
export function relationItemsForLinks(
  links: LinkedRecord[],
  onOpen: OpenRecordHandler | undefined,
): RelationItem[] {
  return links.map((link) => {
    const { record, analysis } = link;
    if (!record) {
      return { key: link.canonicalPath, label: link.canonicalPath, identifier: link.canonicalPath };
    }
    return relationItemForRecord(record, analysis, onOpen);
  });
}
