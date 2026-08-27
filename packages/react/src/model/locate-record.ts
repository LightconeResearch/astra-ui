import type { AnalysisIndex, ResolvedAnalysisNode, ResolvedRecord } from '@astra-spec/sdk';

export interface LocatedRecord {
  record: ResolvedRecord;
  analysis: ResolvedAnalysisNode;
}

/** Resolves a canonical path to the record and the analysis that declares it. */
export function locateRecord(index: AnalysisIndex, canonicalPath: string): LocatedRecord | undefined {
  const record = index.recordByPath.get(canonicalPath);
  const analysis = index.analysisByRecordPath.get(canonicalPath);
  return record && analysis ? { record, analysis } : undefined;
}
