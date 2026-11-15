import type { Analysis, ResolvedAnalysis } from '@astra-spec/sdk/reports';
export function analysisAt(document: ResolvedAnalysis, position = 0): Analysis {
  const analysis = document.analyses[position];
  if (!analysis) throw new Error(`Fixture analysis ${position} is missing`);
  return analysis;
}
