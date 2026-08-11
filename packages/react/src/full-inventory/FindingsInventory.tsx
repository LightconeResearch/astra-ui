import { InventoryProse } from './InventoryProse.js';
import { InventoryArtifactPreview } from './InventoryArtifactPreview.js';
import {
  InventoryCountHeading,
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryDetailProse,
  InventoryEmptyState,
  InventoryRecordList,
} from './InventoryPrimitives.js';
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
  quote?: string | undefined;
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
      quote: evidence.quote,
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
      kind="finding"
      eyebrow={`Finding · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.localId : undefined}
      onBack={onBack}
      closeLabel="Close finding details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-finding-detail inventory-record-detail__layout--single">
        <InventoryDetailMain as="main">
          {record.claim ? (
            <InventoryDetailProse label="Finding" className="inventory-finding-detail__claim">
              <InventoryProse text={record.claim} />
            </InventoryDetailProse>
          ) : null}
          {record.notes ? (
            <section className="inventory-finding-detail__notes">
              <h4>Notes</h4>
              <div><InventoryProse text={record.notes} /></div>
            </section>
          ) : null}
          <section className="inventory-finding-evidence-previews">
            <InventoryCountHeading title="Evidence" count={evidence.length} />
            {evidence.length ? (
              <div className="inventory-finding-evidence-previews__list">
                {evidence.map((item, index) => {
                  const title = item.record?.label ?? item.record?.id ?? item.artifact ?? `Evidence ${index + 1}`;
                  return (
                    <article
                      key={`${item.artifact ?? 'evidence'}-${index}`}
                      className="inventory-finding-evidence-preview"
                    >
                      {item.record && item.scope ? (
                        <button
                          type="button"
                          className="inventory-finding-evidence-preview__open"
                          aria-label={`View evidence output: ${title}`}
                          onClick={() => onOpenEvidence(item.record!, item.scope!)}
                        >
                          <span>
                            <strong>{title}</strong>
                            <code>{item.record.canonicalPath}</code>
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      ) : (
                        <div className="inventory-finding-evidence-preview__unresolved">
                          <strong>{title}</strong>
                          {item.artifact ? <code>{item.artifact}</code> : null}
                        </div>
                      )}
                      {item.record ? (
                        <div className={`inventory-output-dialog__preview inventory-finding-evidence-preview__media is-${item.record.outputType}`}>
                          <InventoryArtifactPreview record={item.record} />
                        </div>
                      ) : null}
                      {item.quote ? (
                        <blockquote><InventoryProse text={item.quote} /></blockquote>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : <p>No evidence artifacts are linked to this finding.</p>}
          </section>
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
