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
import { decisionInsights } from './relations.js';

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

/** Looks up metadata by DOI, whichever spelling the host used as the key. */
export function paperMetadataFor(doi: string, metadata: InventoryPaperMetadataMap): InventoryPaperMetadata | undefined {
  const direct = metadata[normalizeDoi(doi)] ?? metadata[doi];
  if (direct) return direct;
  const key = normalizeDoi(doi);
  const match = Object.keys(metadata).find((candidate) => normalizeDoi(candidate) === key);
  return match === undefined ? undefined : metadata[match];
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

  if (analysis.canonicalPath !== '$') {
    for (const decision of decisions.values()) {
      for (const insight of decisionInsights(index, decision)) insights.set(insight.canonicalPath, insight);
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
    const dois = new Set(decisionInsights(index, decision).flatMap(insightDois).map(normalizeDoi));
    for (const key of dois) {
      papers.get(key)?.decisions.push(decision);
    }
  }

  return [...papers.values()].sort((left, right) => left.doi.localeCompare(right.doi));
}

/** The paper a DOI denotes within one analysis' scope (see `collectInventoryPapers`), whether or not the host listed it. */
export function paperForDoi(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  analysis: ResolvedAnalysisNode,
  doi: string,
  paperMetadata: InventoryPaperMetadataMap = {},
): InventoryPaper | undefined {
  return findPaper(collectInventoryPapers(document, index, analysis, paperMetadata), doi);
}

/** Finds a paper in a collection by DOI, tolerant of formatting differences. */
export function findPaper(papers: readonly InventoryPaper[], doi: string): InventoryPaper | undefined {
  const key = normalizeDoi(doi);
  return papers.find((paper) => normalizeDoi(paper.doi) === key);
}

/**
 * The literature evidence an insight is presented against: the first entry
 * with a DOI. A quote without a DOI names no paper to open, so it is skipped;
 * the passage shown and the paper opened always belong to this one entry.
 */
export function primaryLiteratureEvidence(insight: ResolvedInsight) {
  return insight.evidence.find((evidence) => Boolean(evidence.doi));
}

/**
 * A DOI resolves to a landing page, so no general rule turns one into a PDF.
 * arXiv's does: the DOI embeds the arXiv identifier, and `arxiv.org/pdf/<id>`
 * serves the file with CORS and byte ranges, which is what the paper viewer
 * needs to stream it from the browser.
 */
const ARXIV_DOI_PREFIX = '10.48550/arxiv.';
/** New-style `YYMM.NNNNN` identifiers. */
const NEW_STYLE_ARXIV_ID = /^\d{4}\.\d{4,5}$/;
/** Old-style `archive[.subject-class]/YYMMNNN` identifiers, such as `astro-ph/0604362`. */
const OLD_STYLE_ARXIV_ID = /^[a-z][a-z-]*(?:\.[a-z][a-z-]*)?\/\d{7}$/;

/** The arXiv identifier a DOI names, or `undefined` for any other DOI. */
export function arxivIdFromDoi(doi: string): string | undefined {
  const key = normalizeDoi(doi);
  if (!key.startsWith(ARXIV_DOI_PREFIX)) return undefined;
  const id = key.slice(ARXIV_DOI_PREFIX.length);
  return NEW_STYLE_ARXIV_ID.test(id) || OLD_STYLE_ARXIV_ID.test(id) ? id : undefined;
}

/**
 * A `pdfUrl` for every cited arXiv paper, keyed by normalized DOI; other DOIs
 * are left out, so they keep the viewer's link to the DOI. A host merges it
 * under whatever metadata it has of its own.
 *
 * When insights cite different revisions of one paper the newest wins: the
 * viewer reads one file per DOI, and the latest revision is the one most
 * likely to hold every quoted passage. A citation naming no revision reads
 * the latest, so it wins over every pinned one.
 */
export function arxivPaperMetadata(document: ResolvedAnalysisDocument): InventoryPaperMetadataMap {
  const revisions = new Map<string, number | 'latest'>();
  for (const analysis of walkAnalyses(document)) {
    for (const insight of [...analysis.prior_insights, ...analysis.findings]) {
      for (const { doi, version } of insight.evidence) {
        if (typeof doi !== 'string' || !arxivIdFromDoi(doi)) continue;
        const key = normalizeDoi(doi);
        const cited = typeof version === 'number' && Number.isInteger(version) && version > 0 ? version : 'latest';
        const known = revisions.get(key) ?? cited;
        revisions.set(key, cited === 'latest' || known === 'latest' ? 'latest' : Math.max(cited, known));
      }
    }
  }
  const papers: Record<string, InventoryPaperMetadata> = {};
  for (const [key, revision] of revisions) {
    papers[key] = {
      pdfUrl: `https://arxiv.org/pdf/${arxivIdFromDoi(key)}${revision === 'latest' ? '' : `v${revision}`}`,
    };
  }
  return papers;
}
