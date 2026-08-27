import {
  normalizeDoi,
  walkAnalyses,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedDecision,
  type ResolvedEvidence,
  type ResolvedInsight,
} from '@astra-spec/sdk';
import { decisionInsightPaths } from './relations.js';
import { isInsight } from './records.js';

export interface InventoryPaper {
  doi: string;
  title: string;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
  insights: ResolvedInsight[];
  decisions: ResolvedDecision[];
}

export type PaperFetchStatus = 'idle' | 'fetching' | 'error';

export interface InventoryPaperMetadata {
  title?: string | undefined;
  authors?: string | undefined;
  pdfUrl?: string | undefined;
  /** Host-owned fetch state; the dialog reflects it and disables the fetch control while pending. */
  status?: PaperFetchStatus | undefined;
  error?: string | undefined;
}

export type InventoryPaperMetadataMap = Readonly<Record<string, InventoryPaperMetadata>>;

export interface PaperFocusEvidence {
  insight: ResolvedInsight;
  evidence: ResolvedEvidence;
}

/** Looks up metadata by canonical or raw DOI. */
export function paperMetadataFor(doi: string, metadata: InventoryPaperMetadataMap): InventoryPaperMetadata | undefined {
  return metadata[normalizeDoi(doi)] ?? metadata[doi];
}

function paperFromDoi(doi: string, paperMetadata: InventoryPaperMetadataMap): InventoryPaper {
  const canonicalDoi = normalizeDoi(doi);
  const metadata = paperMetadataFor(doi, paperMetadata);
  return {
    doi: canonicalDoi,
    title: metadata?.title ?? canonicalDoi,
    authors: metadata?.authors,
    pdfUrl: metadata?.pdfUrl,
    insights: [],
    decisions: [],
  };
}

export function insightDois(insight: ResolvedInsight): string[] {
  const seen = new Set<string>();
  const dois: string[] = [];
  for (const { doi } of insight.evidence) {
    if (!doi) continue;
    const key = normalizeDoi(doi);
    if (seen.has(key)) continue;
    seen.add(key);
    dois.push(doi);
  }
  return dois;
}

/** Quoted evidence an insight draws from a given paper. */
export function paperEvidence(insight: ResolvedInsight, doi: string): ResolvedEvidence[] {
  const key = normalizeDoi(doi);
  return insight.evidence.filter((evidence) => evidence.quote && normalizeDoi(evidence.doi ?? '') === key);
}

/** The root inventory aggregates cited papers; child inventories stay local. */
export function analysesForPaperView(document: ResolvedAnalysisDocument, analysis: ResolvedAnalysisNode): ResolvedAnalysisNode[] {
  return analysis.canonicalPath === '$' ? [...walkAnalyses(document)] : [analysis];
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
    for (const record of candidate.decisions) decisions.set(record.canonicalPath, record);
    for (const record of [...candidate.prior_insights, ...candidate.findings]) insights.set(record.canonicalPath, record);
  }

  const insightsOf = (decision: ResolvedDecision) => decisionInsightPaths(decision)
    .map((path) => index.recordByPath.get(path))
    .filter(isInsight);

  if (analysis.canonicalPath !== '$') {
    for (const decision of decisions.values()) {
      for (const insight of insightsOf(decision)) insights.set(insight.canonicalPath, insight);
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
    const dois = new Set(insightsOf(decision).flatMap(insightDois).map(normalizeDoi));
    for (const key of dois) {
      papers.get(key)?.decisions.push(decision);
    }
  }

  return [...papers.values()].sort((left, right) => left.doi.localeCompare(right.doi));
}

/** Finds a paper in a collection by DOI, tolerant of formatting differences. */
export function findPaper(papers: readonly InventoryPaper[], doi: string): InventoryPaper | undefined {
  const key = normalizeDoi(doi);
  return papers.find((paper) => normalizeDoi(paper.doi) === key);
}
