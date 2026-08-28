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
  /** Decisions the output declares directly. */
  decisions: LinkedRecord[];
  /**
   * Decisions reached through upstream outputs (see `indirectDecisionPaths`).
   * `outputRelations()` always fills it (possibly empty); optional so hosts
   * assembling relations by hand can leave it out.
   */
  indirectDecisions?: LinkedRecord[] | undefined;
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
 * Decisions an output depends on only through its upstream outputs: the
 * provenance of every input that is (or aliases) an output, followed
 * recursively, minus the output's own direct decisions. Document order of
 * discovery; cycles are ignored.
 */
export function indirectDecisionPaths(index: AnalysisIndex, output: ResolvedOutput): string[] {
  const direct = new Set(output.provenance.decisionPaths);
  const seen = new Set<string>([output.canonicalPath]);
  const found: string[] = [];
  const queue = [...output.provenance.inputPaths];
  // Array iteration sees entries pushed while it runs, so the walk is a BFS.
  for (const path of queue) {
    if (seen.has(path)) continue;
    seen.add(path);
    let record = index.recordByPath.get(path);
    if (record?.kind === 'input' && record.resolvedFrom) record = index.recordByPath.get(record.resolvedFrom);
    if (record?.kind !== 'output') continue;
    for (const decisionPath of record.provenance.decisionPaths) {
      if (!direct.has(decisionPath) && !found.includes(decisionPath)) found.push(decisionPath);
    }
    queue.push(...record.provenance.inputPaths);
    if (record.resolvedFrom) queue.push(record.resolvedFrom);
  }
  return found;
}

/** Inputs, direct and indirect decisions, and alias source an output depends on; a record referenced twice (e.g. through an alias) is listed once. */
export function outputRelations(index: AnalysisIndex, output: ResolvedOutput): OutputRelations {
  const unique = (paths: readonly string[]) => [...new Set(paths)];
  return {
    inputs: unique(output.provenance.inputPaths).map((path) => linkedRecord(index, path)),
    decisions: unique(output.provenance.decisionPaths).map((path) => linkedRecord(index, path)),
    indirectDecisions: indirectDecisionPaths(index, output).map((path) => linkedRecord(index, path)),
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
