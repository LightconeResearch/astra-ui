// Playground-local derivations for the pre-refactor API. The library did not
// export these, so the baseline stories reproduce what InventoryExplorer does
// internally to feed the standalone dialogs.
import {
  indexAnalysis,
  walkAnalyses,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedDecision,
  type ResolvedInsight,
  type ResolvedOutput,
  type ResolvedRecord,
} from '@astra-spec/sdk';

export function locate(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  canonicalPath: string,
): { record: ResolvedRecord; analysis: ResolvedAnalysisNode } | undefined {
  const record = index.recordByPath.get(canonicalPath);
  if (!record) return undefined;
  for (const analysis of walkAnalyses(document)) {
    const owns = [
      ...analysis.inputs,
      ...analysis.outputs,
      ...analysis.decisions,
      ...analysis.prior_insights,
      ...analysis.findings,
    ].some((candidate) => candidate.canonicalPath === canonicalPath);
    if (owns) return { record, analysis };
  }
  return undefined;
}

export function outputRelations(document: ResolvedAnalysisDocument, output: ResolvedOutput) {
  const index = indexAnalysis(document);
  const link = (canonicalPath: string) => {
    const located = locate(document, index, canonicalPath);
    return { canonicalPath, ...(located ? { record: located.record, analysis: located.analysis } : {}) };
  };
  return {
    inputs: output.provenance.inputPaths.map(link),
    decisions: output.provenance.decisionPaths.map(link),
    ...(output.resolvedFrom ? { alias: link(output.resolvedFrom) } : {}),
  };
}

export function findingEvidence(document: ResolvedAnalysisDocument, finding: ResolvedInsight) {
  const index = indexAnalysis(document);
  return finding.evidence
    .filter((evidence) => evidence.artifact || evidence.resolvedOutputPath)
    .map((evidence) => {
      const located = evidence.resolvedOutputPath
        ? locate(document, index, evidence.resolvedOutputPath)
        : undefined;
      const output = located?.record.kind === 'output' ? located.record : undefined;
      return { evidence, ...(output && located ? { output, analysis: located.analysis } : {}) };
    });
}

export function decisionInsights(document: ResolvedAnalysisDocument, decision: ResolvedDecision): ResolvedInsight[] {
  const index = indexAnalysis(document);
  const paths = [...new Set(decision.options.flatMap((option) => option.resolvedInsightPaths))];
  return paths
    .map((path) => index.recordByPath.get(path))
    .filter((record): record is ResolvedInsight => record?.kind === 'prior_insight' || record?.kind === 'finding');
}

export function informedDecisions(document: ResolvedAnalysisDocument, insight: ResolvedInsight): ResolvedDecision[] {
  const decisions: ResolvedDecision[] = [];
  for (const analysis of walkAnalyses(document)) {
    for (const decision of analysis.decisions) {
      if (decision.options.some((option) => option.resolvedInsightPaths.includes(insight.canonicalPath))) {
        decisions.push(decision);
      }
    }
  }
  return decisions;
}

export function byPath<T extends ResolvedRecord>(document: ResolvedAnalysisDocument, canonicalPath: string): T {
  const record = indexAnalysis(document).recordByPath.get(canonicalPath);
  if (!record) throw new Error(`Fixture has no record at ${canonicalPath}`);
  return record as T;
}
