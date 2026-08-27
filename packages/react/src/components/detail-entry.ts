/** What a detail surface is showing: a record, or a paper (optionally focused on an insight). */
export type DetailEntry =
  | { kind: 'record'; canonicalPath: string; analysisPath: string }
  | { kind: 'paper'; doi: string; analysisPath: string; focusInsightPath?: string | undefined };

export function recordEntry(canonicalPath: string, analysisPath: string): DetailEntry {
  return { kind: 'record', canonicalPath, analysisPath };
}

export function paperEntry(doi: string, analysisPath: string, focusInsightPath?: string): DetailEntry {
  return { kind: 'paper', doi, analysisPath, ...(focusInsightPath ? { focusInsightPath } : {}) };
}

export function sameEntry(left: DetailEntry, right: DetailEntry): boolean {
  if (left.kind !== right.kind || left.analysisPath !== right.analysisPath) return false;
  return left.kind === 'record'
    ? left.canonicalPath === (right as Extract<DetailEntry, { kind: 'record' }>).canonicalPath
    : left.doi === (right as Extract<DetailEntry, { kind: 'paper' }>).doi;
}
