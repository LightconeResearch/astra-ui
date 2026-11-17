import type { AstraRecord } from '../model/records.js';
import type { Analysis } from '@astra-spec/sdk/reports';
import type { LinkedRecord } from '../model/relations.js';
import { recordTitle, recordKind } from '../model/records.js';
import type { RelationItem } from '../primitives/relation-list.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

// Glue between model records and the RelationList primitive: it needs both
// `recordTitle` from model and the item shape from primitives, which no lower
// layer can see together, so it stays here beside the components that use it.

/** Builds a relation-list item for a record, with navigation when the caller handles it. */
export function relationItemForRecord(
  record: AstraRecord,
  analysis: Analysis | undefined,
  onOpen: OpenRecordHandler | undefined,
  overrides: Partial<RelationItem> = {},
): RelationItem {
  const title = recordTitle(record);
  return {
    key: record.ref,
    label: title,
    kind: recordKind(record),
    accessibleLabel: `View ${recordKind(record)}: ${title}`,
    onOpen:
      analysis && onOpen
        ? () => {
            onOpen(record, analysis);
          }
        : undefined,
    ...overrides,
  };
}

/** Builds relation-list items for linked records; unresolved links show their path. */
export function relationItemsForLinks(links: LinkedRecord[], onOpen: OpenRecordHandler | undefined): RelationItem[] {
  const contexts = new Map<string, Set<string | undefined>>();
  for (const link of links) {
    const values = contexts.get(link.ref) ?? new Set<string | undefined>();
    values.add(link.universeRef);
    contexts.set(link.ref, values);
  }
  return links.map((link) => {
    const { record, analysis } = link,
      key = JSON.stringify([link.ref, link.universeRef]);
    if (!record) return { key, label: link.ref, identifier: link.ref, detail: link.universeRef };
    const qualified = (contexts.get(link.ref)?.size ?? 0) > 1 && link.universeRef !== undefined;
    const title = recordTitle(record);
    return relationItemForRecord(record, analysis, onOpen, {
      key,
      detail: link.universeRef,
      accessibleLabel: `View ${recordKind(record)}: ${title}${qualified ? ` (${link.universeRef})` : ''}`,
      onOpen:
        analysis && onOpen
          ? () => {
              onOpen(record, analysis, link.universeRef);
            }
          : undefined,
    });
  });
}
