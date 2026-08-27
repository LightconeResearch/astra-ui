import {
  indexAnalysis,
  walkAnalyses,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedRecord,
} from '@astra-spec/sdk';

/** The SDK index plus a record-to-owning-analysis map (one extra walk over the document). */
export interface InventoryIndex extends AnalysisIndex {
  ownerByRecordPath: ReadonlyMap<string, ResolvedAnalysisNode>;
}

export interface LocatedRecord {
  record: ResolvedRecord;
  analysis: ResolvedAnalysisNode;
}

export function createInventoryIndex(document: ResolvedAnalysisDocument): InventoryIndex {
  const index = indexAnalysis(document);
  const ownerByRecordPath = new Map<string, ResolvedAnalysisNode>();
  for (const analysis of walkAnalyses(document)) {
    for (const record of [
      ...analysis.inputs,
      ...analysis.outputs,
      ...analysis.decisions,
      ...analysis.prior_insights,
      ...analysis.findings,
    ]) {
      ownerByRecordPath.set(record.canonicalPath, analysis);
    }
  }
  return { ...index, ownerByRecordPath };
}

/** Resolves a canonical path to the record and the analysis that declares it. */
export function locateRecord(index: InventoryIndex, canonicalPath: string): LocatedRecord | undefined {
  const record = index.recordByPath.get(canonicalPath);
  const analysis = index.ownerByRecordPath.get(canonicalPath);
  return record && analysis ? { record, analysis } : undefined;
}
