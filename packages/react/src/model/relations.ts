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
  return [...collectOutputDecisions(index, output).keys()];
}

/**
 * The immediate upstream outputs each decision arrives through, for the ones
 * an output does not declare itself. A decision reachable through two upstream
 * outputs names both; decisions the output declares are omitted.
 */
export function outputDecisionRoutes(index: AnalysisIndex, output: ResolvedOutput): Map<string, Set<string>> {
  return new Map([...collectOutputDecisions(index, output)].filter(([, via]) => via.size));
}

/** Ordered decisions and their routes, derived in one walk for every consumer. */
function collectOutputDecisions(index: AnalysisIndex, output: ResolvedOutput): Map<string, Set<string>> {
  const direct = new Set(output.provenance.decisionPaths);
  // Empty routes mark direct decisions, which always precede inherited ones.
  const decisions = new Map([...direct].map((path) => [path, new Set<string>()]));
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
      const found = decisions.get(decisionPath) ?? new Set<string>();
      found.add(via);
      decisions.set(decisionPath, found);
    }
    const next = [...record.provenance.inputPaths, ...(record.resolvedFrom ? [record.resolvedFrom] : [])];
    queue.push(...next.map((path) => ({ path, via })));
  }
  return decisions;
}

/** Inputs, every decision on a dependency path, and alias source an output depends on; a record referenced twice (e.g. through an alias) is listed once. */
export function outputRelations(index: AnalysisIndex, output: ResolvedOutput): OutputRelations {
  const unique = (paths: readonly string[]) => [...new Set(paths)];
  const decisions = collectOutputDecisions(index, output);
  return {
    inputs: unique(output.provenance.inputPaths).map((path) => linkedRecord(index, path)),
    decisions: [...decisions].map(([path, via]) => ({
      ...linkedRecord(index, path),
      ...(via.size ? { via: [...via].map((from) => linkedRecord(index, from)) } : {}),
    })),
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
