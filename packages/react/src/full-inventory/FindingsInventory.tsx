import { InventoryProse } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryEmptyState,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import {
  getInventoryScope,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  resolveInventoryRecordReference,
  type InventoryModel,
} from './model.js';
import type {
  InventoryFindingRecord,
  InventoryOutputRecord,
  InventoryScope,
} from '../types.js';

interface FindingsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenFinding: (finding: InventoryFindingRecord, scope: InventoryScope) => void;
}

interface ResolvedFindingEvidence {
  artifact?: string | undefined;
  record?: InventoryOutputRecord | undefined;
  scope?: InventoryScope | undefined;
}

function evidenceLabel(count: number): string {
  return `${count} ${count === 1 ? 'artifact' : 'artifacts'}`;
}

function findingEvidence(
  model: InventoryModel,
  scope: InventoryScope,
  finding: InventoryFindingRecord,
): ResolvedFindingEvidence[] {
  return (finding.evidence ?? []).map((evidence) => {
    const resolved = evidence.artifactRecordId
      ? resolveInventoryRecordReference(model, scope, evidence.artifactRecordId, 'output')
      : undefined;
    return {
      artifact: evidence.artifactRecordId,
      record: resolved?.record.kind === 'output' ? resolved.record : undefined,
      scope: resolved?.scope,
    };
  });
}

export function FindingDialog({
  record,
  scope,
  model,
  onOpenEvidence,
  onBack,
  onClose,
}: {
  record: InventoryFindingRecord;
  scope: InventoryScope;
  model: InventoryModel;
  onOpenEvidence: (output: InventoryOutputRecord, scope: InventoryScope) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  const evidence = findingEvidence(model, scope, record);
  return (
    <InventoryDetailDialog
      className="inventory-detail-dialog--finding"
      kind="finding"
      eyebrow={`Finding · ${scope.name}`}
      title={record.claim ?? inventoryRecordTitle(record)}
      identifier={record.label ? record.localId : undefined}
      onBack={onBack}
      closeLabel="Close finding details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-finding-detail inventory-record-detail__layout--single">
        <InventoryDetailMain as="main">
          {record.notes ? (
            <section className="inventory-finding-detail__notes">
              <h4>Notes</h4>
              <div><InventoryProse text={record.notes} /></div>
            </section>
          ) : null}
          <InventoryRelationList
            className="inventory-finding-supporting-results"
            title="Supporting results"
            empty="No supporting results are linked to this finding."
            items={evidence.map((item, index) => {
              const title = item.record
                ? inventoryRecordTitle(item.record)
                : item.artifact ?? `Result ${index + 1}`;
              return {
                key: `${item.artifact ?? 'result'}-${index}`,
                label: title,
                identifier: item.record?.canonicalPath ?? item.artifact,
                detail: item.record?.outputType ?? 'Unavailable',
                kind: 'output' as const,
                accessibleLabel: item.record ? `View supporting result: ${title}` : undefined,
                onOpen: item.record && item.scope
                  ? () => onOpenEvidence(item.record!, item.scope!)
                  : undefined,
              };
            })}
          />
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export function FindingsInventory({
  model,
  scopeId,
  onOpenFinding,
}: FindingsInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const records = scope ? inventoryRecordsOfKind(scope, 'finding', model) : [];

  if (!scope || !records.length) {
    return <InventoryEmptyState>No findings are declared in this analysis.</InventoryEmptyState>;
  }

  return (
    <div className="inventory-records inventory-records--findings">
      <InventoryRecordList
        ariaLabel="Findings"
        columnTemplate="minmax(18rem, 1fr) 7rem 1.5rem"
        columns={[
          { label: 'Finding', className: 'inventory-record-list__primary' },
          { label: 'Evidence', className: 'inventory-record-list__count inventory-record-list__secondary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={records.map((record) => {
          const count = record.evidence?.length ?? 0;
          return {
            key: record.id,
            accessibleLabel: `${inventoryRecordTitle(record)}: ${record.claim ?? 'Finding claim unavailable'} ${evidenceLabel(count)}`,
            onOpen: () => onOpenFinding(record, scope),
            cells: [
              <span className="inventory-record-list__name inventory-finding-list__claim">
                <span className="inventory-record-list__glyph" aria-hidden="true">●</span>
                <span>
                  {record.label ? <small>{record.label}</small> : null}
                  <strong>{record.claim ?? inventoryRecordTitle(record)}</strong>
                </span>
              </span>,
              <span>{evidenceLabel(count)}</span>,
              <span aria-hidden="true">→</span>,
            ],
          };
        })}
      />
    </div>
  );
}
