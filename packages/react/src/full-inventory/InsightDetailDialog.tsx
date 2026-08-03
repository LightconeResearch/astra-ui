import { InventoryProse } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryDetailLayout,
  InventoryDetailMain,
  InventoryDetailProse,
  InventoryDetailRail,
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
} from './types.js';

function insightEvidenceName(entry: InventoryInsightRecord): string {
  return entry.label ?? entry.id;
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

  return (
    <InventoryDetailDialog
      kind="prior_insight"
      eyebrow={`Insight · ${scope.name}`}
      title={title}
      identifier={insight.label ? insight.id : undefined}
      onBack={onBack}
      closeLabel="Close insight details"
      onClose={onClose}
    >
      <InventoryDetailLayout className="inventory-insight-detail">
        <InventoryDetailMain as="main">
          {insight.claim ? (
            <InventoryDetailProse label="Claim">
              <InventoryProse text={insight.claim} />
            </InventoryDetailProse>
          ) : null}
          {insight.quote ? (
            <section className="inventory-insight-detail__source-quote">
              <h4>Source quote</h4>
              <blockquote><InventoryProse text={insight.quote} /></blockquote>
              {insight.doi && onOpenSource ? (
                <button
                  type="button"
                  className="inventory-insight-detail__open-source"
                  onClick={onOpenSource}
                >
                  View quote in paper <span aria-hidden="true">→</span>
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
        </InventoryDetailMain>
        <InventoryDetailRail label="Insight details">
          {insight.doi ? (
            <section className="inventory-paper-doi">
              <h4>Source paper</h4>
              <a href={doiHref(insight.doi)} target="_blank" rel="noreferrer">
                {insight.doi}{insight.page ? ` · page ${insight.page}` : ''} ↗
              </a>
            </section>
          ) : null}
          <InventoryRelationList
            title="Informs"
            items={decisions.map((decision) => ({
              key: decision.path,
              label: inventoryRecordTitle(decision),
              identifier: decision.path,
              accessibleLabel: `View decision: ${inventoryRecordTitle(decision)}`,
              onOpen: onOpenDecision ? () => onOpenDecision(decision) : undefined,
            }))}
            empty="No decisions in this scope cite this insight."
          />
        </InventoryDetailRail>
      </InventoryDetailLayout>
    </InventoryDetailDialog>
  );
}
