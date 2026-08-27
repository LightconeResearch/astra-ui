import { useEffect, useState, type ReactNode } from 'react';
import {
  normalizeDoi,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedDecision,
  type ResolvedEvidence,
  type ResolvedInsight,
} from '@astra-spec/sdk';
import { InventoryProse } from './InventoryProse.js';
import type { TextRenderer } from './InventoryProse.js';
import { InsightDetailTrigger } from './InsightDetailDialog.js';
import {
  InventoryCountHeading,
  InventoryDetailDialog,
  InventoryEmptyState,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import {
  doiHref,
} from './citationMetadata.js';
import {
  analysesForPaperView,
  analysisTitle,
  decisionInsights,
  recordTitle,
} from './inventory-data.js';

export interface PapersInventoryProps {
  papers: InventoryPaper[];
  analysis: ResolvedAnalysisNode;
  onOpenPaper: (paper: InventoryPaper, analysis: ResolvedAnalysisNode) => void;
}

export interface InventoryPaper {
  doi: string;
  title: string;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
  insights: ResolvedInsight[];
  decisions: ResolvedDecision[];
}

export interface InventoryPaperMetadata {
  title?: string | undefined;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
}

export type InventoryPaperMetadataMap = Readonly<Record<string, InventoryPaperMetadata>>;

export interface PaperFocusEvidence {
  insight: ResolvedInsight;
  evidence: ResolvedEvidence;
}

export interface PaperRenderOptions {
  focusEvidence?: PaperFocusEvidence | undefined;
}

/** Host slot for PDF, HTML, or any other paper presentation. */
export type PaperRenderer = (
  paper: InventoryPaper,
  options: PaperRenderOptions,
) => ReactNode;

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

type InventoryEvidence = ResolvedEvidence;

function insightDois(insight: ResolvedInsight): string[] {
  const dois = insight.evidence
    .map((evidence) => evidence.doi)
    .filter((doi): doi is string => Boolean(doi));
  return dois.filter(
    (doi, index) => dois.findIndex(
      (candidate) => normalizeDoi(candidate) === normalizeDoi(doi),
    ) === index,
  );
}

function paperEvidence(
  insight: ResolvedInsight,
  doi: string,
): InventoryEvidence[] {
  return insight.evidence.filter(
    (evidence) =>
      evidence.quote
      && normalizeDoi(evidence.doi ?? '') === normalizeDoi(doi),
  );
}

export function collectInventoryPapers(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  analysis: ResolvedAnalysisNode,
  paperMetadata: InventoryPaperMetadataMap = {},
): InventoryPaper[] {
  const analyses = analysesForPaperView(document, analysis);
  const insights = new Map<string, ResolvedInsight>();
  const decisions = new Map<string, ResolvedDecision>();

  for (const candidate of analyses) {
    for (const record of candidate.decisions) {
      decisions.set(record.canonicalPath, record);
    }
    for (const record of [...candidate.prior_insights, ...candidate.findings]) {
      insights.set(record.canonicalPath, record);
    }
  }

  if (analysis.canonicalPath !== '$') {
    for (const decision of decisions.values()) {
      for (const insight of decisionInsights(index, decision)) {
        insights.set(insight.canonicalPath, insight);
      }
    }
  }

  const papers = new Map<string, InventoryPaper>();

  for (const insight of insights.values()) {
    for (const doi of insightDois(insight)) {
      const key = normalizeDoi(doi);
      const paper = papers.get(key) ?? paperFromDoi(doi, paperMetadata);
      if (!paper.insights.some((candidate) => candidate.canonicalPath === insight.canonicalPath)) {
        paper.insights.push(insight);
      }
      papers.set(key, paper);
    }
  }

  for (const decision of decisions.values()) {
    const dois = new Set(
      decisionInsights(index, decision)
        .flatMap(insightDois)
        .map(normalizeDoi),
    );
    for (const key of dois) {
      const paper = papers.get(key);
      if (paper) paper.decisions.push(decision);
    }
  }

  return [...papers.values()].sort((left, right) => left.doi.localeCompare(right.doi));
}

export interface PaperDialogProps {
  paper: InventoryPaper;
  analysis: ResolvedAnalysisNode;
  initialFocusInsight?: ResolvedInsight | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  /** Notify the host to fetch this DOI; refreshed metadata returns through props. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  onOpenInsight: (insight: ResolvedInsight) => void;
  onOpenDecision: (decision: ResolvedDecision) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

export function PaperDialog({
  paper,
  analysis,
  initialFocusInsight,
  renderText,
  renderPaper,
  onFetchPaper,
  onOpenInsight,
  onOpenDecision,
  onBack,
  onClose,
}: PaperDialogProps) {
  const initialEvidence = initialFocusInsight
    ? paperEvidence(initialFocusInsight, paper.doi)[0]
    : undefined;
  const [focusEvidence, setFocusEvidence] = useState<PaperFocusEvidence | undefined>(() => (
    initialFocusInsight && initialEvidence?.quote
      ? { insight: initialFocusInsight, evidence: initialEvidence }
      : undefined
  ));
  useEffect(() => {
    setFocusEvidence(
      initialFocusInsight && initialEvidence?.quote
        ? { insight: initialFocusInsight, evidence: initialEvidence }
        : undefined,
    );
  }, [initialEvidence, initialFocusInsight, paper.doi]);

  return (
    <InventoryDetailDialog
      className="inventory-detail-dialog--paper inventory-detail-dialog--reader"
      kind="paper"
      eyebrow={`Paper · ${analysisTitle(analysis)}`}
      title={paper.title}
      onBack={onBack}
      headerActions={(
        paper.pdfUrl ? (
          <a
            className="inventory-detail-dialog__header-action"
            href={paper.pdfUrl}
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
          {paper.pdfUrl && renderPaper ? (
            <>{renderPaper(paper, { focusEvidence })}</>
          ) : (
            <div className="inventory-paper-dialog__unavailable">
              {!paper.pdfUrl && onFetchPaper ? (
                <>
                  <p>No paper content is available from this host.</p>
                  <button type="button" onClick={() => onFetchPaper(paper.doi)}>
                    Fetch paper
                  </button>
                </>
              ) : (
                <p>
                  {paper.pdfUrl
                    ? 'This host has not supplied an embedded paper renderer.'
                    : 'Follow the DOI for the published version.'}
                </p>
              )}
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
                  <li key={insight.canonicalPath} className="astra-evidence__item inventory-paper-insight">
                    <InsightDetailTrigger
                      insight={insight}
                      tag=""
                      onOpen={() => onOpenInsight(insight)}
                    />
                    <div className="inventory-paper-insight__claim">
                      <InventoryProse text={insight.claim} renderText={renderText} />
                    </div>
                    {evidence.length ? (
                      <div className="inventory-paper-insight__sources">
                        <span>
                          {evidence.length} {evidence.length === 1 ? 'passage' : 'passages'}
                        </span>
                        {paper.pdfUrl && renderPaper ? (
                          <div>
                            {evidence.map((source, index) => (
                              <button
                                key={`${insight.canonicalPath}-${index}`}
                                type="button"
                                className="inventory-paper-insight__locate"
                                onClick={() => setFocusEvidence({ insight, evidence: source })}
                                aria-label={`Locate source passage ${index + 1} in paper`}
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
              key: decision.canonicalPath,
              label: recordTitle(decision),
              kind: 'decision',
              accessibleLabel: `View decision: ${recordTitle(decision)}`,
              onOpen: () => onOpenDecision(decision),
            }))}
            empty="No decisions in this analysis cite insights from this paper."
          />
        </aside>
      </div>
    </InventoryDetailDialog>
  );
}

export function PapersInventory({
  papers,
  analysis,
  onOpenPaper,
}: PapersInventoryProps) {
  if (!papers.length) {
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
            onClick={() => onOpenPaper(paper, analysis)}
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
