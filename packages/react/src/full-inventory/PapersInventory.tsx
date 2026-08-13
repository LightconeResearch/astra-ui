import { useEffect, useRef, useState } from 'react';
import { InventoryProse } from './InventoryProse.js';
import { InsightDetailTrigger } from './InsightDetailDialog.js';
import {
  InventoryCountHeading,
  InventoryDetailDialog,
  InventoryEmptyState,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import { PaperPdfViewer, type PaperQuoteFocusRequest } from './PaperPdfViewer.js';
import {
  citationTitleFromHtml,
  doiHref,
  normalizeDoi,
} from './citationMetadata.js';
import {
  getInventoryScope,
  inventoryDecisionInsights,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  inventoryScopesForView,
  type InventoryModel,
} from './model.js';
import type {
  InventoryDecisionRecord,
  InventoryInsightRecord,
  InventoryScope,
} from '../types.js';

interface PapersInventoryProps {
  model: InventoryModel;
  scopeId: string;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  onOpenPaper: (paper: InventoryPaper, scope: InventoryScope) => void;
}

export interface InventoryPaper {
  doi: string;
  title: string;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
  insights: InventoryInsightRecord[];
  decisions: InventoryDecisionRecord[];
}

export interface InventoryPaperMetadata {
  title?: string | undefined;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
}

export type InventoryPaperMetadataMap = Readonly<Record<string, InventoryPaperMetadata>>;

export function paperMetadataFromCitations(
  citations: unknown,
): InventoryPaperMetadataMap {
  if (!citations || typeof citations !== 'object') return {};
  return Object.fromEntries(
    Object.values(citations).flatMap((citation: any) => {
      const doi = typeof citation?.doi === 'string'
        ? normalizeDoi(citation.doi)
        : undefined;
      const title = citationTitleFromHtml(citation?.html);
      return doi && title ? [[doi, { title }]] : [];
    }),
  );
}

function paperFromDoi(doi: string, paperMetadata: InventoryPaperMetadataMap): InventoryPaper {
  const canonicalDoi = normalizeDoi(doi);
  const metadata = paperMetadata[canonicalDoi] ?? paperMetadata[doi];
  return {
    doi: canonicalDoi,
    title: metadata?.title ?? canonicalDoi,
    authors: metadata?.authors,
    pdfUrl: metadata?.pdfUrl,
    insights: [],
    decisions: [],
  };
}

type InventoryEvidence = NonNullable<InventoryInsightRecord['evidence']>[number];

function normalizedDoi(doi: string): string {
  return normalizeDoi(doi);
}

function insightDois(insight: InventoryInsightRecord): string[] {
  const dois = insight.evidence
    .map((evidence) => evidence.doi)
    .filter((doi): doi is string => Boolean(doi));
  return dois.filter(
    (doi, index) => dois.findIndex(
      (candidate) => normalizedDoi(candidate) === normalizedDoi(doi),
    ) === index,
  );
}

function paperEvidence(
  insight: InventoryInsightRecord,
  doi: string,
): InventoryEvidence[] {
  return insight.evidence.filter(
    (evidence) =>
      evidence.quote
      && normalizedDoi(evidence.doi ?? '') === normalizedDoi(doi),
  );
}

export function paperRecords(
  model: InventoryModel,
  scope: InventoryScope,
  paperMetadata: InventoryPaperMetadataMap = {},
): InventoryPaper[] {
  const scopes = inventoryScopesForView(model, scope);
  const insights = new Map<string, InventoryInsightRecord>();
  const decisions = new Map<string, InventoryDecisionRecord>();

  for (const candidate of scopes) {
    for (const record of inventoryRecordsOfKind(candidate, 'decision', model)) {
      decisions.set(record.id, record);
    }
    for (const record of inventoryRecordsOfKind(candidate, 'prior_insight', model)) {
      insights.set(record.id, record);
    }
  }

  if (scope.parentId) {
    for (const decision of decisions.values()) {
      const decisionScope = model.scopeById.get(decision.scopeId) ?? scope;
      for (const insight of inventoryDecisionInsights(model, decisionScope, decision)) {
        insights.set(insight.id, insight);
      }
    }
  }

  const papers = new Map<string, InventoryPaper>();

  for (const insight of insights.values()) {
    for (const doi of insightDois(insight)) {
      const key = normalizedDoi(doi);
      const paper = papers.get(key) ?? paperFromDoi(doi, paperMetadata);
      if (!paper.insights.some((candidate) => candidate.id === insight.id)) {
        paper.insights.push(insight);
      }
      papers.set(key, paper);
    }
  }

  for (const decision of decisions.values()) {
    const decisionScope = model.scopeById.get(decision.scopeId) ?? scope;
    const dois = new Set(
      inventoryDecisionInsights(model, decisionScope, decision)
        .flatMap(insightDois)
        .map(normalizedDoi),
    );
    for (const key of dois) {
      const paper = papers.get(key);
      if (paper) paper.decisions.push(decision);
    }
  }

  return [...papers.values()].sort((left, right) => left.doi.localeCompare(right.doi));
}

export function PaperDialog({
  paper,
  scope,
  initialFocusInsight,
  pdfAssetBaseUrl,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
  onBack,
  onClose,
}: {
  paper: InventoryPaper;
  scope: InventoryScope;
  initialFocusInsight?: InventoryInsightRecord | undefined;
  pdfAssetBaseUrl?: string | undefined;
  onFetchPaper?: ((doi: string) => Promise<InventoryPaperMetadata>) | undefined;
  onOpenInsight: (insight: InventoryInsightRecord) => void;
  onOpenDecision: (decision: InventoryDecisionRecord) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  const initialEvidence = initialFocusInsight
    ? paperEvidence(initialFocusInsight, paper.doi)[0]
    : undefined;
  const [focusRequest, setFocusRequest] = useState<PaperQuoteFocusRequest | undefined>(() => (
    initialFocusInsight && initialEvidence?.quote ? {
      key: `${initialFocusInsight.id}-source`,
      insightId: initialFocusInsight.id,
      quote: initialEvidence.quote,
      page: initialEvidence.page,
    } : undefined
  ));
  const [fetchedMetadata, setFetchedMetadata] = useState<InventoryPaperMetadata>();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string>();
  const focusSequence = useRef(0);
  const pdfUrl = fetchedMetadata?.pdfUrl ?? paper.pdfUrl;
  const title = fetchedMetadata?.title ?? paper.title;

  useEffect(() => {
    setFetchedMetadata(undefined);
    setFetching(false);
    setFetchError(undefined);
  }, [paper.doi]);

  const fetchMissingPaper = async () => {
    if (!onFetchPaper || fetching) return;
    setFetching(true);
    setFetchError(undefined);
    try {
      const metadata = await onFetchPaper(paper.doi);
      if (!metadata.pdfUrl) {
        throw new Error('The paper was fetched without a readable PDF.');
      }
      setFetchedMetadata(metadata);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Could not fetch this paper.');
    } finally {
      setFetching(false);
    }
  };

  const focusInsight = (
    insight: InventoryInsightRecord,
    evidence: InventoryEvidence,
  ) => {
    if (!evidence.quote) return;
    focusSequence.current += 1;
    setFocusRequest({
      key: `${insight.id}-${focusSequence.current}`,
      insightId: insight.id,
      quote: evidence.quote,
      page: evidence.page,
    });
  };

  return (
    <InventoryDetailDialog
      className="inventory-detail-dialog--paper inventory-detail-dialog--reader"
      kind="paper"
      eyebrow={`Paper · ${scope.name}`}
      title={title}
      onBack={onBack}
      headerActions={(
        pdfUrl ? (
          <a
            className="inventory-detail-dialog__header-action"
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open ↗
          </a>
        ) : null
      )}
      closeLabel="Close paper details"
      onClose={onClose}
    >
      <div className="inventory-paper-dialog__layout">
        <div className="inventory-paper-dialog__artifact">
          {pdfUrl ? (
            <PaperPdfViewer
              pdfUrl={pdfUrl}
              title={title}
              focusRequest={focusRequest}
              pdfAssetBaseUrl={pdfAssetBaseUrl ?? ''}
            />
          ) : (
            <div className="inventory-paper-dialog__unavailable">
              <p>This paper is not in your ASTRA paper cache.</p>
              {onFetchPaper ? (
                <button type="button" disabled={fetching} onClick={() => void fetchMissingPaper()}>
                  {fetching ? 'Fetching paper…' : 'Fetch paper'}
                </button>
              ) : null}
              {fetchError ? <p role="alert">{fetchError}</p> : null}
            </div>
          )}
        </div>
        <aside className="inventory-paper-dialog__rail" aria-label="Paper insights and decisions">
          <section className="inventory-paper-doi">
            <h4>DOI</h4>
            <a href={doiHref(paper.doi)} target="_blank" rel="noreferrer">
              {paper.doi} ↗
            </a>
          </section>
          <section className="inventory-insight-list">
            <InventoryCountHeading title="Insights from this paper" count={paper.insights.length} />
            <ul className="astra-evidence inventory-paper-insights">
              {paper.insights.map((insight) => {
                const evidence = paperEvidence(insight, paper.doi);
                return (
                  <li key={insight.id} className="astra-evidence__item inventory-paper-insight">
                    <InsightDetailTrigger
                      insight={insight}
                      tag=""
                      onOpen={() => onOpenInsight(insight)}
                    />
                    {insight.claim ? (
                      <div className="inventory-paper-insight__claim">
                        <InventoryProse text={insight.claim} />
                      </div>
                    ) : null}
                    {evidence.length ? (
                      <div className="inventory-paper-insight__sources">
                        <span>
                          {evidence.length} {evidence.length === 1 ? 'passage' : 'passages'}
                        </span>
                        {pdfUrl ? (
                          <div>
                            {evidence.map((source, index) => (
                              <button
                                key={`${insight.id}-${index}`}
                                type="button"
                                className="inventory-paper-insight__locate"
                                onClick={() => focusInsight(insight, source)}
                                aria-label={`Locate source passage ${index + 1} in PDF`}
                              >
                                Locate{evidence.length > 1 ? ` ${index + 1}` : ''}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
          <InventoryRelationList
            title="Informs decisions"
            className="inventory-record-detail__relations inventory-paper-informs"
            items={paper.decisions.map((decision) => ({
              key: decision.id,
              label: inventoryRecordTitle(decision),
              kind: 'decision',
              accessibleLabel: `View decision: ${inventoryRecordTitle(decision)}`,
              onOpen: () => onOpenDecision(decision),
            }))}
            empty="No decisions in this scope cite insights from this paper."
          />
        </aside>
      </div>
    </InventoryDetailDialog>
  );
}

export function PapersInventory({
  model,
  scopeId,
  paperMetadata = {},
  onOpenPaper,
}: PapersInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const papers = scope ? paperRecords(model, scope, paperMetadata) : [];

  if (!scope || !papers.length) {
    return (
      <InventoryEmptyState>No supporting papers are linked to this analysis.</InventoryEmptyState>
    );
  }

  return (
    <div className="inventory-records inventory-records--papers">
      <div className="inventory-paper-list" aria-label="Papers">
        {papers.map((paper) => (
          <button
            key={paper.doi}
            type="button"
            aria-label={`${paper.title}, ${paper.doi}, ${paper.insights.length} insights, ${paper.decisions.length} decisions`}
            onClick={() => onOpenPaper(paper, scope)}
          >
            <span className="inventory-paper-list__thumbnail" aria-hidden="true">p.1</span>
            <span className="inventory-paper-list__copy">
              <strong>{paper.title}</strong>
              <small>{[paper.authors, paper.doi].filter(Boolean).join(' · ')}</small>
            </span>
            <span className="inventory-paper-list__meta">
              {paper.insights.length} {paper.insights.length === 1 ? 'insight' : 'insights'} ·{' '}
              {paper.decisions.length} {paper.decisions.length === 1 ? 'decision' : 'decisions'}
            </span>
            <span className="inventory-paper-list__arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
