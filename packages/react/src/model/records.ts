import type { Analysis, Decision, Input, Insight, Output, Universe } from '@astra-spec/sdk/reports';

/** The report elements shown as records by the UI. No transport fields are added. */
export type AstraRecord = Input | Decision | Output | Insight;
export type RecordKind = 'input' | 'decision' | 'output' | 'prior_insight' | 'finding';
export function recordKind(record: AstraRecord): RecordKind {
  if (record.kind === 'prior_insight' || record.kind === 'finding') return record.kind;
  if (typeof record.format === 'string') return 'output';
  if (typeof record.path === 'string') return 'input';
  return 'decision';
}
/** A short display identifier; navigation always uses the complete ref. */
export function recordId(record: AstraRecord): string {
  return record.ref.split('.').at(-1) ?? record.ref;
}
function nonEmpty(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  return text;
}
export function analysisTitle(analysis: Analysis): string {
  return nonEmpty(analysis.label) ?? nonEmpty(analysis.key) ?? 'Analysis';
}
export function recordTitle(record: AstraRecord): string {
  return nonEmpty(record.label) ?? recordId(record);
}
export function selectedOptionLabel(decision: Decision, universe?: Universe): string {
  const selected = universe?.selection[decision.ref];
  return decision.options.find(({ id }) => id === selected)?.label ?? selected ?? 'Not selected';
}
export function isInsight(record: AstraRecord | undefined): record is Insight {
  return record?.kind === 'prior_insight' || record?.kind === 'finding';
}
export function isOutput(record: AstraRecord | undefined): record is Output {
  return Boolean(record && recordKind(record) === 'output');
}
export function isVisualOutput(output: Output): boolean {
  return output.type === 'figure' || output.type === 'table';
}
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
export function inputSourceLabel(record: Input): string {
  return record.path;
}
export function decisionTagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag] ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}
