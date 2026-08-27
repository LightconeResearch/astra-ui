import {
  walkAnalyses,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedDecision,
  type ResolvedInsight,
  type ResolvedRecord,
} from '@astra-spec/sdk';

export interface LocatedRecord {
  record: ResolvedRecord;
  analysis: ResolvedAnalysisNode;
}

export function analysisTitle(analysis: ResolvedAnalysisNode): string {
  return analysis.name?.trim()
    || analysis.id?.trim()
    || (analysis.canonicalPath === '$' ? 'Analysis' : analysis.canonicalPath);
}

export function recordTitle(record: ResolvedRecord): string {
  return record.label?.trim() || record.id;
}

export function selectedOptionLabel(decision: ResolvedDecision): string {
  if (!decision.selectedOptionId) return decision.active ? 'Not selected' : 'Inactive';
  return decision.options.find(({ id }) => id === decision.selectedOptionId)?.label
    ?? decision.selectedOptionId;
}

export function locateRecord(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  canonicalPath: string,
): LocatedRecord | undefined {
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
    if (owns) {
      return { record, analysis };
    }
  }
  return undefined;
}

export function decisionInsightPaths(decision: ResolvedDecision): string[] {
  const selected = decision.options.find(({ id }) => id === decision.selectedOptionId);
  return [...new Set([
    ...(selected?.resolvedInsightPaths ?? []),
    ...decision.options
      .filter(({ id }) => id !== decision.selectedOptionId)
      .flatMap(({ resolvedInsightPaths }) => resolvedInsightPaths),
  ])];
}

function isInsight(record: ResolvedRecord | undefined): record is ResolvedInsight {
  return record?.kind === 'prior_insight' || record?.kind === 'finding';
}

export function decisionInsights(
  index: AnalysisIndex,
  decision: ResolvedDecision,
): ResolvedInsight[] {
  return decisionInsightPaths(decision)
    .map((path) => index.recordByPath.get(path))
    .filter(isInsight);
}

export function informedDecisions(
  document: ResolvedAnalysisDocument,
  insight: ResolvedInsight,
): ResolvedDecision[] {
  const decisions = new Map<string, ResolvedDecision>();
  for (const analysis of walkAnalyses(document)) {
    for (const decision of analysis.decisions) {
      if (
        decision.options.some(({ resolvedInsightPaths }) => (
          resolvedInsightPaths.includes(insight.canonicalPath)
        ))
      ) {
        decisions.set(decision.canonicalPath, decision);
      }
    }
  }
  return [...decisions.values()];
}

/** The root inventory aggregates cited papers; child inventories stay local. */
export function analysesForPaperView(
  document: ResolvedAnalysisDocument,
  analysis: ResolvedAnalysisNode,
): ResolvedAnalysisNode[] {
  return analysis.canonicalPath === '$' ? [...walkAnalyses(document)] : [analysis];
}
