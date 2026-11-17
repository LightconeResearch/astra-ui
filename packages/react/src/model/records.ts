import type { Analysis, Decision, Input, Insight, Output, ResolvedAnalysisIndex, Universe } from '@astra-spec/sdk/reports';
import { locateRecord } from './locate-record.js';

/** The report elements the UI shows as records. */
export type AstraRecord = Input | Decision | Output | Insight;
export type RecordKind = 'input' | 'decision' | 'output' | 'prior_insight' | 'finding';

/**
 * A record's kind. With an index it is the collection that declares the ref.
 * Without one it is read from the fields each element type requires: report
 * elements carry no kind of their own except insights, and the schema is open,
 * so a single extra field (an input's `format`, say) must not decide it.
 */
export function recordKind(record: AstraRecord, index?: ResolvedAnalysisIndex): RecordKind {
  const located = index ? locateRecord(index, record.ref) : undefined;
  if (located) return located.kind;
  if (record.kind === 'prior_insight' || record.kind === 'finding') return record.kind;
  if (Array.isArray(record.options)) return 'decision';
  if (typeof record.type === 'string' && typeof record.format === 'string' && Array.isArray(record.decisions)) {
    return 'output';
  }
  if (typeof record.path === 'string') return 'input';
  return 'decision';
}

/** A short display identifier; navigation always uses the complete ref. */
export function recordId(record: AstraRecord): string {
  return record.ref.split('.').at(-1) ?? record.ref;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function analysisTitle(analysis: Analysis): string {
  return nonEmpty(analysis.label) ?? nonEmpty(analysis.key) ?? 'Analysis';
}

export function recordTitle(record: AstraRecord): string {
  return nonEmpty(record.label) ?? recordId(record);
}

/** The option `universe` selects for a decision; without a universe nothing is selected. */
export function selectedOptionLabel(decision: Decision, universe?: Universe): string {
  const selected = universe && Object.hasOwn(universe.selection, decision.ref) ? universe.selection[decision.ref] : undefined;
  return decision.options.find(({ id }) => id === selected)?.label ?? selected ?? 'Not selected';
}

export function isInsight(record: AstraRecord | undefined): record is Insight {
  return record?.kind === 'prior_insight' || record?.kind === 'finding';
}

export function isOutput(record: AstraRecord | undefined): record is Output {
  return Boolean(record && recordKind(record) === 'output');
}

/** Figures and tables get the reader layout; everything else is a single-column detail. */
export function isVisualOutput(output: Output): boolean {
  return output.type === 'figure' || output.type === 'table';
}

/** Pluralises a count with the given singular/plural nouns. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Where an input comes from: its repository path. */
export function inputSourceLabel(record: Input): string {
  return record.path;
}

/** A decision tag's display label: the host's, or the tag itself in sentence case. */
export function decisionTagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag]
    ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}
