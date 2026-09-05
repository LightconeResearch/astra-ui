import type { AnalysisIndex, ResolvedRecord } from '@astra-spec/sdk';
import {
  paperEntry,
  recordEntry,
  type DetailEntry
} from './detail-entry.js';

export type InventoryRecordKind = ResolvedRecord['kind'];

export interface InventoryRecordOpenReference {
  kind: InventoryRecordKind;
  id: string;
  canonicalPath?: string;
}

export interface InventoryPaperOpenReference {
  kind: 'paper';
  doi: string;
}

/** The stable postMessage/command shape emitted by ASTRA publications. */
export type InventoryOpenReference =
  | InventoryRecordOpenReference
  | InventoryPaperOpenReference;

const RECORD_KINDS = new Set<InventoryRecordKind>([
  'input',
  'output',
  'decision',
  'finding',
  'prior_insight'
]);

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Validate untrusted command arguments or cross-frame messages. */
export function parseInventoryOpenReference(
  value: unknown
): InventoryOpenReference | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as {
    kind?: unknown;
    id?: unknown;
    doi?: unknown;
    canonicalPath?: unknown;
  };
  if (candidate.kind === 'paper') {
    const doi = nonEmptyString(candidate.doi);
    return doi ? { kind: 'paper', doi } : undefined;
  }
  if (
    typeof candidate.kind !== 'string' ||
    !RECORD_KINDS.has(candidate.kind as InventoryRecordKind)
  ) {
    return undefined;
  }
  const id = nonEmptyString(candidate.id);
  if (!id) return undefined;
  const canonicalPath = nonEmptyString(candidate.canonicalPath);
  return {
    kind: candidate.kind as InventoryRecordKind,
    id,
    ...(canonicalPath ? { canonicalPath } : {})
  };
}

/** Resolve the publication wire format against the resolved-analysis index. */
export function detailEntryForOpenReference(
  index: AnalysisIndex,
  reference: InventoryOpenReference,
  requestedAnalysisPath = '$'
): DetailEntry | undefined {
  const analysisPath = index.analysisByPath.has(requestedAnalysisPath)
    ? requestedAnalysisPath
    : '$';
  if (reference.kind === 'paper') {
    return paperEntry(reference.doi, analysisPath);
  }

  const exact = reference.canonicalPath
    ? index.recordByPath.get(reference.canonicalPath)
    : undefined;
  const matchingExact = exact?.kind === reference.kind ? exact : undefined;
  const candidates = matchingExact
    ? [matchingExact]
    : [...index.recordByPath.values()].filter(record => (
        record.kind === reference.kind && record.id === reference.id
      ));
  const record = candidates.find(candidate => (
    index.analysisByRecordPath.get(candidate.canonicalPath)?.canonicalPath ===
    analysisPath
  )) ?? candidates[0];
  if (!record) return undefined;
  const owner = index.analysisByRecordPath.get(record.canonicalPath);
  return recordEntry(
    record.canonicalPath,
    owner?.canonicalPath ?? analysisPath
  );
}
