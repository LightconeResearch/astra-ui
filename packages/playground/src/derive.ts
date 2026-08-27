import { indexAnalysis, type ResolvedAnalysisDocument, type ResolvedRecord } from '@astra-spec/sdk';

/** Fetches a fixture record by canonical path, failing loudly when the fixture drifts. */
export function byPath<T extends ResolvedRecord>(document: ResolvedAnalysisDocument, canonicalPath: string): T {
  const record = indexAnalysis(document).recordByPath.get(canonicalPath);
  if (!record) throw new Error(`Fixture has no record at ${canonicalPath}`);
  return record as T;
}
