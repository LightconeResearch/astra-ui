import { indexResolvedAnalysis, type ResolvedAnalysis } from '@astra-spec/sdk/reports';
import type { AstraRecord } from '@astra-spec/ui/model';
/** Fetches a report element by its opaque canonical ref, failing if the fixture drifts. */
export function byPath<T extends AstraRecord>(document: ResolvedAnalysis, ref: string): T {
  const found = indexResolvedAnalysis(document).elementByRef.get(ref);
  if (!found) throw new Error(`Fixture has no record at ${ref}`);
  return found.element as T;
}
