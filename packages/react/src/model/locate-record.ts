import type { Analysis, Decision, Input, Insight, Output, ResolvedAnalysisIndex } from '@astra-spec/sdk/reports';
export type LocatedRecord =
  | { kind: 'input'; record: Input; analysis: Analysis }
  | { kind: 'decision'; record: Decision; analysis: Analysis }
  | { kind: 'output'; record: Output; analysis: Analysis }
  | { kind: 'prior_insight' | 'finding'; record: Insight; analysis: Analysis };
/** Retains the original report element and its declaring analysis. */
export function locateRecord(index: ResolvedAnalysisIndex, ref: string): LocatedRecord | undefined {
  const found = index.elementByRef.get(ref);
  if (!found) return undefined;
  switch (found.collection) {
    case 'inputs':
      return { kind: 'input', record: found.element, analysis: found.analysis };
    case 'decisions':
      return { kind: 'decision', record: found.element, analysis: found.analysis };
    case 'outputs':
      return { kind: 'output', record: found.element, analysis: found.analysis };
    case 'prior_insights':
      return { kind: 'prior_insight', record: found.element, analysis: found.analysis };
    case 'findings':
      return { kind: 'finding', record: found.element, analysis: found.analysis };
    default:
      return undefined;
  }
}
