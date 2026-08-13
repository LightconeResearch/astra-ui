import { InventoryProse } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryDetailProse,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import { doiHref } from './citationMetadata.js';
import {
  inventoryInformedDecisions,
  inventoryRecordTitle,
  type InventoryModel,
} from './model.js';
import type {
  InventoryDecisionRecord,
  InventoryInsightRecord,
  InventoryScope,
} from '../types.js';

function insightEvidenceName(entry: InventoryInsightRecord): string {
  return entry.label ?? entry.localId;
}

function primaryLiteratureEvidence(insight: InventoryInsightRecord) {
  return insight.evidence.find((evidence) => evidence.doi || evidence.quote);
}

function InsightEvidenceTitle({
  name,
  tag,
}: {
  name: string;
  tag?: string | undefined;
}) {
  return (
    <span className="astra-evidence__title">
      <span className="astra-evidence__glyph--insight" aria-hidden="true">◈</span>
      <span className="astra-evidence__name">{name}</span>
      {tag ? <span className="astra-evidence__tag">{tag}</span> : null}
    </span>
  );
}

export function InsightDetailTrigger({
  insight,
  onOpen,
  tag = 'prior insight',
  variant = 'title',
}: {
  insight: InventoryInsightRecord;
  onOpen: () => void;
  tag?: string | undefined;
  variant?: 'title' | 'claim' | undefined;
}) {
  const title = insightEvidenceName(insight);
  if (variant === 'claim') {
    return (
      <div
        className="inventory-insight-trigger inventory-insight-trigger--claim"
        role="button"
        tabIndex={0}
        aria-label={`Open insight details: ${title}`}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        <span className="astra-evidence__glyph--insight" aria-hidden="true">◈</span>
        <div className="inventory-insight-trigger__claim">
          <InventoryProse text={insight.claim ?? title} />
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="astra-ref-trigger inventory-insight-trigger"
      aria-label={`Open insight details: ${title}`}
      onClick={onOpen}
    >
      <InsightEvidenceTitle name={title} tag={tag} />
    </button>
  );
}

export function InsightDetailDialog({
  insight,
  model,
  scope,
  onOpenSource,
  onOpenDecision,
  onBack,
  onClose,
}: {
  insight: InventoryInsightRecord;
  model: InventoryModel;
  scope: InventoryScope;
  onOpenSource?: (() => void) | undefined;
  onOpenDecision?: ((decision: InventoryDecisionRecord) => void) | undefined;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  const decisions = inventoryInformedDecisions(model, scope, insight);
  const title = insightEvidenceName(insight);
  const source = primaryLiteratureEvidence(insight);

  return (
    <InventoryDetailDialog
      kind="prior_insight"
      eyebrow={`Insight · ${scope.name}`}
      title={title}
      identifier={insight.label ? insight.localId : undefined}
      onBack={onBack}
      closeLabel="Close insight details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-insight-detail inventory-record-detail__layout--single">
        <InventoryDetailMain as="main">
          {insight.claim ? (
            <InventoryDetailProse label="Claim">
              <InventoryProse text={insight.claim} />
            </InventoryDetailProse>
          ) : null}
          {source?.doi ? (
            <section className="inventory-insight-detail__paper inventory-paper-doi">
              <h4>Source paper</h4>
              {onOpenSource ? (
                <button type="button" onClick={onOpenSource}>
                  {source.doi}{source.page ? ` · page ${source.page}` : ''} ↗
                </button>
              ) : (
                <a href={doiHref(source.doi)} target="_blank" rel="noreferrer">
                  {source.doi}{source.page ? ` · page ${source.page}` : ''} ↗
                </a>
              )}
            </section>
          ) : null}
          {source?.quote ? (
            <section className="inventory-insight-detail__source-quote">
              <h4>Source passage</h4>
              <blockquote><InventoryProse text={source.quote} /></blockquote>
              {source.doi && onOpenSource ? (
                <button
                  type="button"
                  className="inventory-insight-detail__open-source"
                  onClick={onOpenSource}
                >
                  Locate passage in paper <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </section>
          ) : null}
          {insight.notes ? (
            <section className="inventory-insight-detail__notes">
              <h4>Notes</h4>
              <div><InventoryProse text={insight.notes} /></div>
            </section>
          ) : null}
          <InventoryRelationList
            title="Informs decisions"
            items={decisions.map((decision) => ({
              key: decision.id,
              label: inventoryRecordTitle(decision),
              kind: 'decision',
              accessibleLabel: `View decision: ${inventoryRecordTitle(decision)}`,
              onOpen: onOpenDecision ? () => onOpenDecision(decision) : undefined,
            }))}
            empty="No decisions in this scope cite this insight."
          />
        </InventoryDetailMain>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}
