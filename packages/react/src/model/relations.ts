import type {
  ResolvedAnalysisNode,
  ResolvedDecision,
  ResolvedEvidence,
  ResolvedInsight,
  ResolvedOutput,
  ResolvedRecord,
} from '@astra-spec/sdk';
import { walkAnalyses, type AnalysisIndex, type ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { locateRecord } from './locate-record.js';
import { isInsight } from './records.js';

/** A referenced record; `record`/`analysis` are absent when the path does not resolve. */
export interface LinkedRecord {
  canonicalPath: string;
  record?: ResolvedRecord | undefined;
  analysis?: ResolvedAnalysisNode | undefined;
}

export interface OutputRelations {
  inputs: LinkedRecord[];
  /**
   * Every decision on a dependency path to the output: the ones it declares,
   * then those reached through upstream outputs, in any analysis (see
   * `outputDecisionPaths`). `via` names the immediate upstream outputs a
   * decision arrives through, and is absent on one the output declares.
   */
  decisions: (LinkedRecord & { via?: LinkedRecord[] | undefined })[];
  alias?: LinkedRecord | undefined;
}

export interface FindingEvidenceLink {
  evidence: ResolvedEvidence;
  output?: ResolvedOutput | undefined;
  analysis?: ResolvedAnalysisNode | undefined;
}

export function linkedRecord(index: AnalysisIndex, canonicalPath: string): LinkedRecord {
  const located = locateRecord(index, canonicalPath);
  return {
    canonicalPath,
    ...(located ? { record: located.record, analysis: located.analysis } : {}),
  };
}

/**
 * Every decision with a dependency path to an output: the ones its own
 * provenance declares, then those of every upstream output — an input that
 * is (or aliases) an output, the output's own alias target, and so on
 * recursively, across analyses. Direct decisions come first in document
 * order, then the rest in order of discovery; a decision reached by several
 * paths is listed once, and cycles are ignored.
 */
export function outputDecisionPaths(index: AnalysisIndex, output: ResolvedOutput): string[] {
  const found = [...new Set(output.provenance.decisionPaths)];
  const seen = new Set<string>([output.canonicalPath]);
  const queue = [...output.provenance.inputPaths];
  if (output.resolvedFrom) queue.push(output.resolvedFrom);
  // Array iteration sees entries pushed while it runs, so the walk is a BFS.
  for (const path of queue) {
    if (seen.has(path)) continue;
    seen.add(path);
    let record = index.recordByPath.get(path);
    if (record?.kind === 'input' && record.resolvedFrom) record = index.recordByPath.get(record.resolvedFrom);
    if (record?.kind !== 'output') continue;
    for (const decisionPath of record.provenance.decisionPaths) {
      if (!found.includes(decisionPath)) found.push(decisionPath);
    }
    queue.push(...record.provenance.inputPaths);
    if (record.resolvedFrom) queue.push(record.resolvedFrom);
  }
  return found;
}

/**
 * The immediate upstream outputs each decision arrives through, for the ones
 * an output does not declare itself. Unlike `outputDecisionPaths` this walks
 * once per route rather than once per record, so a decision reachable through
 * two upstream outputs names both; a decision the output declares maps to no
 * route at all.
 */
export function outputDecisionRoutes(index: AnalysisIndex, output: ResolvedOutput): Map<string, Set<string>> {
  const direct = new Set(output.provenance.decisionPaths);
  const routes = new Map<string, Set<string>>();
  const seenByRoute = new Map<string, Set<string>>();
  const queue: { path: string; via?: string }[] = [
    ...output.provenance.inputPaths.map((path) => ({ path })),
    ...(output.resolvedFrom ? [{ path: output.resolvedFrom }] : []),
  ];
  // Array iteration sees entries pushed while it runs, so the walk is a BFS.
  for (const entry of queue) {
    let record = index.recordByPath.get(entry.path);
    if (record?.kind === 'input' && record.resolvedFrom) record = index.recordByPath.get(record.resolvedFrom);
    if (record?.kind !== 'output' || record.canonicalPath === output.canonicalPath) continue;
    // The first upstream output on a path is the route; deeper hops keep it.
    const via = entry.via ?? record.canonicalPath;
    const walked = seenByRoute.get(via) ?? new Set<string>();
    if (walked.has(record.canonicalPath)) continue;
    walked.add(record.canonicalPath);
    seenByRoute.set(via, walked);
    for (const decisionPath of record.provenance.decisionPaths) {
      if (direct.has(decisionPath)) continue;
      const found = routes.get(decisionPath) ?? new Set<string>();
      found.add(via);
      routes.set(decisionPath, found);
    }
    const next = [...record.provenance.inputPaths, ...(record.resolvedFrom ? [record.resolvedFrom] : [])];
    queue.push(...next.map((path) => ({ path, via })));
  }
  return routes;
}

/** Inputs, every decision on a dependency path, and alias source an output depends on; a record referenced twice (e.g. through an alias) is listed once. */
export function outputRelations(index: AnalysisIndex, output: ResolvedOutput): OutputRelations {
  const unique = (paths: readonly string[]) => [...new Set(paths)];
  const routes = outputDecisionRoutes(index, output);
  return {
    inputs: unique(output.provenance.inputPaths).map((path) => linkedRecord(index, path)),
    decisions: outputDecisionPaths(index, output).map((path) => {
      const via = routes.get(path);
      return { ...linkedRecord(index, path), ...(via?.size ? { via: [...via].map((from) => linkedRecord(index, from)) } : {}) };
    }),
    ...(output.resolvedFrom ? { alias: linkedRecord(index, output.resolvedFrom) } : {}),
  };
}

/** Artifact-backed evidence of a finding, resolved to outputs where possible. */
export function findingEvidence(index: AnalysisIndex, finding: ResolvedInsight): FindingEvidenceLink[] {
  return finding.evidence
    .filter((evidence) => Boolean(evidence.artifact) || Boolean(evidence.resolvedOutputPath))
    .map((evidence) => {
      const located = evidence.resolvedOutputPath
        ? locateRecord(index, evidence.resolvedOutputPath)
        : undefined;
      const output = located?.record.kind === 'output' ? located.record : undefined;
      return {
        evidence,
        ...(output && located ? { output, analysis: located.analysis } : {}),
      };
    });
}

/** A supporting result and every evidence entry a finding anchors into it. */
export interface FindingEvidenceGroup {
  /** Resolved output path when known, else the artifact name. */
  key: string;
  output?: ResolvedOutput | undefined;
  analysis?: ResolvedAnalysisNode | undefined;
  artifact?: string | undefined;
  evidence: ResolvedEvidence[];
}

/**
 * Folds evidence links onto the result they cite. A finding that anchors two
 * quotes into the same artifact — one per quantity its claim names — is
 * supported by one result, not two identical-looking ones. Order of first
 * appearance; every entry is kept, so no anchor is dropped.
 */
export function groupFindingEvidence(links: FindingEvidenceLink[]): FindingEvidenceGroup[] {
  const groups = new Map<string, FindingEvidenceGroup>();
  for (const link of links) {
    // `findingEvidence` keeps only links carrying one of these, so the key exists.
    const key = link.evidence.resolvedOutputPath ?? link.evidence.artifact ?? link.evidence.id;
    const existing = groups.get(key);
    if (existing) {
      existing.evidence.push(link.evidence);
      continue;
    }
    groups.set(key, {
      key,
      ...(link.output ? { output: link.output } : {}),
      ...(link.analysis ? { analysis: link.analysis } : {}),
      ...(link.evidence.artifact ? { artifact: link.evidence.artifact } : {}),
      evidence: [link.evidence],
    });
  }
  return [...groups.values()];
}

/** Literature evidence (a DOI, with or without a quote) a finding or insight cites. */
export function findingLiterature(finding: ResolvedInsight): ResolvedEvidence[] {
  return finding.evidence.filter((evidence) => Boolean(evidence.doi));
}

/** Insight paths cited by a decision's options, selected option first. */
export function decisionInsightPaths(decision: ResolvedDecision): string[] {
  const selected = decision.options.find(({ id }) => id === decision.selectedOptionId);
  return [...new Set([
    ...(selected?.resolvedInsightPaths ?? []),
    ...decision.options
      .filter(({ id }) => id !== decision.selectedOptionId)
      .flatMap(({ resolvedInsightPaths }) => resolvedInsightPaths),
  ])];
}

export function decisionInsights(index: Pick<AnalysisIndex, 'recordByPath'>, decision: ResolvedDecision): ResolvedInsight[] {
  return decisionInsightPaths(decision)
    .map((path) => index.recordByPath.get(path))
    .filter(isInsight);
}

/** Decisions anywhere in the document whose options cite this insight. */
export function informedDecisions(document: ResolvedAnalysisDocument, insight: ResolvedInsight): ResolvedDecision[] {
  const decisions = new Map<string, ResolvedDecision>();
  for (const analysis of walkAnalyses(document)) {
    for (const decision of analysis.decisions) {
      if (decision.options.some(({ resolvedInsightPaths }) => resolvedInsightPaths.includes(insight.canonicalPath))) {
        decisions.set(decision.canonicalPath, decision);
      }
    }
  }
  return [...decisions.values()];
}
