import { Fragment, useRef, useState } from 'react';
import { InventoryProse } from './InventoryProse.js';
import { InsightDetailTrigger } from './InsightDetailDialog.js';
import {
  InventoryCountHeading,
  InventoryDetailDialog,
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import { PaperPdfViewer, type PaperQuoteFocusRequest } from './PaperPdfViewer.js';
import {
  citationTitleFromHtml,
  directCitationPdfUrl,
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
} from './types.js';

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
      const pdfUrl = directCitationPdfUrl(citation?.url);
      return doi && (title || pdfUrl) ? [[doi, { title, pdfUrl }]] : [];
    }),
  );
}

function paperFromDoi(doi: string, paperMetadata: InventoryPaperMetadataMap): InventoryPaper {
  const canonicalDoi = normalizeDoi(doi);
  const metadata = paperMetadata[canonicalDoi] ?? paperMetadata[doi];
  const arxivId = /^10\.48550\/arxiv\.(.+)$/i.exec(canonicalDoi)?.[1];
  const arxivPdfId = arxivId
    ?.split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return {
    doi: canonicalDoi,
    title: metadata?.title ?? (arxivId ? `arXiv ${arxivId}` : canonicalDoi),
    authors: metadata?.authors,
    pdfUrl: metadata?.pdfUrl
      ?? (arxivPdfId ? `https://arxiv.org/pdf/${arxivPdfId}` : undefined),
    insights: [],
    decisions: [],
  };
}

type InventoryEvidence = NonNullable<InventoryInsightRecord['evidence']>[number];

function normalizedDoi(doi: string): string {
  return normalizeDoi(doi);
}

function insightDois(insight: InventoryInsightRecord): string[] {
  const dois = [
    insight.doi,
    ...(insight.evidence ?? []).map((evidence) => evidence.doi),
  ].filter((doi): doi is string => Boolean(doi));
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
  const matching = (insight.evidence ?? []).filter(
    (evidence) =>
      evidence.quote
      && normalizedDoi(evidence.doi ?? insight.doi ?? '') === normalizedDoi(doi),
  );
  if (matching.length) return matching;
  return insight.quote && insight.doi
    && normalizedDoi(insight.doi) === normalizedDoi(doi)
    ? [{ doi: insight.doi, quote: insight.quote, page: insight.page }]
    : [];
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
    for (const record of inventoryRecordsOfKind(candidate, 'decision')) {
      decisions.set(record.path, record);
    }
    for (const record of inventoryRecordsOfKind(candidate, 'prior_insight')) {
      insights.set(record.path, record);
    }
  }

  if (scope.parent) {
    for (const decision of decisions.values()) {
      const decisionScope = model.recordByPath.get(decision.path)?.scope ?? scope;
      for (const insight of inventoryDecisionInsights(model, decisionScope, decision)) {
        insights.set(insight.path, insight);
      }
    }
  }

  const papers = new Map<string, InventoryPaper>();

  for (const insight of insights.values()) {
    for (const doi of insightDois(insight)) {
      const key = normalizedDoi(doi);
      const paper = papers.get(key) ?? paperFromDoi(doi, paperMetadata);
      if (!paper.insights.some((candidate) => candidate.path === insight.path)) {
        paper.insights.push(insight);
      }
      papers.set(key, paper);
    }
  }

  for (const decision of decisions.values()) {
    const decisionScope = model.recordByPath.get(decision.path)?.scope ?? scope;
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
  onOpenInsight,
  onOpenDecision,
  onBack,
  onClose,
}: {
  paper: InventoryPaper;
  scope: InventoryScope;
  initialFocusInsight?: InventoryInsightRecord | undefined;
  pdfAssetBaseUrl?: string | undefined;
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
  const focusSequence = useRef(0);

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
      className="inventory-detail-dialog--paper"
      kind="paper"
      eyebrow={`Paper · ${scope.name}`}
      title={paper.title}
      onBack={onBack}
      closeLabel="Close paper details"
      onClose={onClose}
    >
      <div className="inventory-paper-dialog__layout">
        {paper.pdfUrl ? (
          <PaperPdfViewer
            pdfUrl={paper.pdfUrl}
            title={paper.title}
            focusRequest={focusRequest}
            pdfAssetBaseUrl={pdfAssetBaseUrl ?? ''}
          />
        ) : <p className="inventory-paper-dialog__unavailable">No PDF source is available for this paper.</p>}
        <aside className="inventory-paper-dialog__rail" aria-label="Paper insights and decisions">
          <section className="inventory-insight-list">
            <InventoryCountHeading title="Insights from this paper" count={paper.insights.length} />
            <ul className="astra-evidence">
              {paper.insights.map((insight) => {
                const evidence = paperEvidence(insight, paper.doi);
                return (
                  <li key={insight.path} className="astra-evidence__item">
                  <InsightDetailTrigger insight={insight} onOpen={() => onOpenInsight(insight)} />
                  {insight.label && insight.claim ? (
                    <div className="astra-evidence__note">
                      <InventoryProse text={insight.claim} />
                    </div>
                  ) : null}
                  {evidence.map((source, index) => (
                    <Fragment key={`${insight.path}-${index}`}>
                      <blockquote className="inventory-paper-insight__quote">{source.quote}</blockquote>
                      {paper.pdfUrl ? (
                        <button
                          type="button"
                          className="inventory-paper-insight__locate"
                          onClick={() => focusInsight(insight, source)}
                        >
                          Locate quote in PDF
                        </button>
                      ) : null}
                    </Fragment>
                  ))}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="inventory-paper-doi">
            <h4>DOI</h4>
            <a href={doiHref(paper.doi)} target="_blank" rel="noreferrer">
              {paper.doi} ↗
            </a>
          </section>
          <InventoryRelationList
            title="Informs"
            items={paper.decisions.map((decision) => ({
              key: decision.path,
              label: inventoryRecordTitle(decision),
              identifier: decision.path,
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
      <InventoryRecordList
        ariaLabel="Papers"
        columnTemplate="minmax(16rem, 1.7fr) 7rem 7rem 1.5rem"
        columns={[
          { label: 'Paper', className: 'inventory-record-list__primary' },
          { label: 'Insights', className: 'inventory-record-list__count' },
          { label: 'Decisions', className: 'inventory-record-list__count' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={papers.map((paper) => ({
          key: paper.doi,
          accessibleLabel: `${paper.title}, ${paper.doi}, ${paper.insights.length} insights, ${paper.decisions.length} decisions`,
          onOpen: () => onOpenPaper(paper, scope),
          cells: [
            <InventoryRecordIdentity
              kind="paper"
              title={paper.title}
              subtitle={[paper.authors, paper.doi].filter(Boolean).join(' · ')}
            />,
            <span>{paper.insights.length} {paper.insights.length === 1 ? 'insight' : 'insights'}</span>,
            <span>{paper.decisions.length} {paper.decisions.length === 1 ? 'decision' : 'decisions'}</span>,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </div>
  );
}
