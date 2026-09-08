import type {
  ResolvedAnalysisNode,
  ResolvedDecision,
  ResolvedInput,
  ResolvedInsight,
  ResolvedOutput,
  ResolvedRecord,
} from '@astra-spec/sdk';

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function analysisTitle(analysis: ResolvedAnalysisNode): string {
  return nonEmpty(analysis.name)
    ?? nonEmpty(analysis.id)
    ?? (analysis.canonicalPath === '$' ? 'Analysis' : analysis.canonicalPath);
}

export function recordTitle(record: ResolvedRecord): string {
  return nonEmpty(record.label) ?? record.id;
}

export function selectedOptionLabel(decision: ResolvedDecision): string {
  if (!decision.selectedOptionId) return decision.active ? 'Not selected' : 'Inactive';
  return decision.options.find(({ id }) => id === decision.selectedOptionId)?.label
    ?? decision.selectedOptionId;
}

export function isInsight(record: ResolvedRecord | undefined): record is ResolvedInsight {
  return record?.kind === 'prior_insight' || record?.kind === 'finding';
}

/** Figures and tables get the reader layout; everything else is a single-column detail. */
export function isVisualOutput(output: ResolvedOutput): boolean {
  return output.type === 'figure' || output.type === 'table';
}

/** Pluralises a count with the given singular/plural nouns. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Where an input comes from, as declared, or a placeholder. */
export function inputSourceLabel(record: ResolvedInput): string {
  return record.source ?? record.ref ?? record.resolvedFrom ?? 'Source not declared';
}

/** A decision tag's display label: the host's, or the tag itself in sentence case. */
export function decisionTagLabel(tag: string, labels: Readonly<Record<string, string>>): string {
  return labels[tag]
    ?? tag.replace(/_/g, ' ').replace(/^./, (character: string) => character.toUpperCase());
}
