import type {
  ResolvedAnalysisNode,
  ResolvedEvidence,
  ResolvedInsight,
  ResolvedOutput,
} from '@astra-spec/sdk';
import { InventoryProse } from './InventoryProse.js';
import type { TextRenderer } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryEmptyState,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import { analysisTitle, recordTitle } from './inventory-data.js';

export interface FindingsInventoryProps {
  analysis: ResolvedAnalysisNode;
  onOpenFinding: (finding: ResolvedInsight, analysis: ResolvedAnalysisNode) => void;
}

export interface FindingEvidenceLink {
  evidence: ResolvedEvidence;
  output?: ResolvedOutput | undefined;
  analysis?: ResolvedAnalysisNode | undefined;
}

function evidenceLabel(count: number): string {
  return `${count} evidence ${count === 1 ? 'item' : 'items'}`;
}

export function FindingDialog({
  record,
  analysis,
  evidence,
  renderText,
  onOpenEvidence,
  onBack,
  onClose,
}: FindingDialogProps) {
  return (
    <InventoryDetailDialog
      className="inventory-detail-dialog--finding"
      kind="finding"
      eyebrow={`Finding · ${analysisTitle(analysis)}`}
      title={record.claim}
      identifier={record.label ? record.id : undefined}
      onBack={onBack}
      closeLabel="Close finding details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-finding-detail inventory-record-detail__layout--single">
        <InventoryDetailMain as="main">
          {record.notes ? (
            <section className="inventory-finding-detail__notes">
              <h4>Notes</h4>
              <div><InventoryProse text={record.notes} renderText={renderText} /></div>
            </section>
          ) : null}
          <InventoryRelationList
            className="inventory-finding-supporting-results"
            title="Supporting results"
            empty="No supporting results are linked to this finding."
            items={evidence.map((item, index) => {
              const title = item.output
                ? recordTitle(item.output)
                : item.evidence.artifact ?? `Result ${index + 1}`;
              return {
                key: `${item.evidence.resolvedOutputPath ?? item.evidence.artifact ?? 'result'}-${index}`,
                label: title,
                identifier: item.output?.canonicalPath ?? item.evidence.artifact,
                detail: item.output?.type ?? 'Unavailable',
                kind: 'output' as const,
                accessibleLabel: item.output ? `View supporting result: ${title}` : undefined,
                onOpen: item.output && item.analysis
                  ? () => onOpenEvidence(item.output!, item.analysis!)
                  : undefined,
              };
            })}
          />
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}

export interface FindingDialogProps {
  record: ResolvedInsight;
  analysis: ResolvedAnalysisNode;
  evidence: FindingEvidenceLink[];
  renderText?: TextRenderer | undefined;
  onOpenEvidence: (output: ResolvedOutput, analysis: ResolvedAnalysisNode) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

export function FindingsInventory({
  analysis,
  onOpenFinding,
}: FindingsInventoryProps) {
  const records = analysis.findings;

  if (!records.length) {
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
            key: record.canonicalPath,
            accessibleLabel: `${recordTitle(record)}: ${record.claim} ${evidenceLabel(count)}`,
            onOpen: () => onOpenFinding(record, analysis),
            cells: [
              <span className="inventory-record-list__name inventory-finding-list__claim">
                <span className="inventory-record-list__glyph" aria-hidden="true">●</span>
                <span>
                  {record.label ? <small>{record.label}</small> : null}
                  <strong>{record.claim}</strong>
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
