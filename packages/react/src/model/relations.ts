import {
  getResult,
  getEvidenceBindings,
  traceResultProvenance,
  selectResult,
  type Analysis,
  type Decision,
  type Evidence,
  type Insight,
  type Output,
  type ResolvedAnalysis,
  type ResolvedAnalysisIndex,
  type Result,
  type Switch,
} from '@astra-spec/sdk/reports';
import { locateRecord } from './locate-record.js';
import { isInsight, type AstraRecord } from './records.js';

/** A referenced record; `record`/`analysis` are absent when the ref does not resolve. */
export interface LinkedRecord {
  ref: string;
  universeRef?: string | undefined;
  record?: AstraRecord | undefined;
  analysis?: Analysis | undefined;
}

export interface OutputRelations {
  inputs: LinkedRecord[];
  /**
   * Every decision on a dependency path to the output, from the SDK's provenance
   * trace: the ones it declares, then those reached through upstream results.
   * `via` names the immediate upstream records a decision arrives through, and
   * is absent on one the output declares.
   */
  decisions: (LinkedRecord & { via?: LinkedRecord[] | undefined })[];
  /** Authored switches directly referenced by an unplanned output. */
  switches?: readonly Switch[] | undefined;
}


export interface FindingEvidenceLink {
  evidence: Evidence;
  result?: Result | undefined;
  universeRef?: string | undefined;
  output?: Output | undefined;
  analysis?: Analysis | undefined;
}
export function linkedRecord(index: ResolvedAnalysisIndex, ref: string, universeRef?: string): LinkedRecord {
  const found = locateRecord(index, ref);
  return { ref, universeRef, ...(found ? { record: found.record, analysis: found.analysis } : {}) };
}
/** Select the effective result without interpreting IDs, including once-built outputs. */
export function outputResult(index: ResolvedAnalysisIndex, output: Output, universeRef?: string): Result | undefined {
  return universeRef ? selectResult(index, output.ref, universeRef) : getResult(index, output.ref);
}
function contextKey(ref: string, universeRef?: string): string {
  return JSON.stringify([ref, universeRef]);
}
/** Group SDK provenance occurrences for display; the SDK owns traversal and effective selections. */
function decisionLinks(
  index: ResolvedAnalysisIndex,
  output: Output,
  universeRef?: string,
): OutputRelations['decisions'] {
  const seed = outputResult(index, output, universeRef);
  if (!seed) return output.decisions.map((ref) => linkedRecord(index, ref, universeRef));
  const groups = new Map<string, { link: LinkedRecord; direct: boolean; via: Map<string, LinkedRecord> }>();
  for (const occurrence of traceResultProvenance(index, seed.id).decisions) {
    const key = contextKey(occurrence.decision.ref, occurrence.universe);
    const group = groups.get(key) ?? {
      link: linkedRecord(index, occurrence.decision.ref, occurrence.universe),
      direct: false,
      via: new Map<string, LinkedRecord>(),
    };
    const edge = occurrence.route[0];
    if (occurrence.result.id === seed.id) {
      group.direct = true;
      group.via.clear();
    } else if (!group.direct && edge) {
      const via = edge.source.result ? index.resultById.get(edge.source.result) : undefined;
      const link = via
        ? linkedRecord(index, via.output, via.universe)
        : edge.source.input
          ? linkedRecord(index, edge.source.input)
          : undefined;
      if (link) group.via.set(contextKey(link.ref, link.universeRef), link);
    }
    groups.set(key, group);
  }
  return [...groups.values()].map(({ link, via }) => ({ ...link, ...(via.size ? { via: [...via.values()] } : {}) }));
}
/** Planned results expose effective edges; unplanned outputs retain their canonical authored references. */
export function outputRelations(index: ResolvedAnalysisIndex, output: Output, universeRef?: string): OutputRelations {
  const result = outputResult(index, output, universeRef);
  const inputs = result
    ? result.inputs.flatMap((source) => {
        const upstream = source.result ? index.resultById.get(source.result) : undefined;
        const ref = source.input ?? upstream?.output;
        return ref ? [linkedRecord(index, ref, upstream?.universe)] : [];
      })
    : (output.inputs ?? []).map((reference) => linkedRecord(index, reference.target, reference.universe));
  const switches = inputs.flatMap((link) => {
    const found = index.elementByRef.get(link.ref);
    return found?.collection === 'switches' ? [found.element] : [];
  });
  return {
    inputs: [...new Map(inputs.map((link) => [contextKey(link.ref, link.universeRef), link])).values()],
    decisions: decisionLinks(index, output, universeRef),
    ...(switches.length ? { switches: [...new Map(switches.map((value) => [value.ref, value])).values()] } : {}),
  };
}
/**
 * Artifact-backed evidence of a finding, one link per SDK binding applicable in
 * the viewed universe (all of them when none is given). A binding names the
 * output and result the evidence resolves to there; DOI-only evidence has none.
 */
export function findingEvidence(index: ResolvedAnalysisIndex, finding: Insight, universeRef?: string): FindingEvidenceLink[] {
  return finding.evidence.flatMap((evidence, position) =>
    (getEvidenceBindings(index, finding.ref, position, universeRef) ?? []).map((binding) => {
      const found = binding.output ? locateRecord(index, binding.output) : undefined;
      return {
        evidence,
        universeRef: binding.output ? binding.target_universe : binding.universe,
        result: binding.result ? index.resultById.get(binding.result) : undefined,
        ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}),
      };
    }),
  );
}

/** A supporting result and every evidence entry a finding anchors into it. */
export interface FindingEvidenceGroup {
  key: string;
  universeRef?: string | undefined;
  output?: Output | undefined;
  analysis?: Analysis | undefined;
  result?: Result | undefined;
  artifact?: string | undefined;
  evidence: Evidence[];
}
/**
 * Folds evidence links onto the result they cite. A finding that anchors two
 * quotes into the same artifact — one per quantity its claim names — is
 * supported by one result, not two identical-looking ones. Order of first
 * appearance; every entry is kept, so no anchor is dropped.
 */
export function groupFindingEvidence(links: FindingEvidenceLink[]): FindingEvidenceGroup[] {
  const groups = new Map<string, FindingEvidenceGroup>();
  for (const link of links) {
    const key = JSON.stringify(
      link.result
        ? ['result', link.result.id]
        : link.output
          ? ['output', link.output.ref, link.universeRef]
          : ['artifact', link.evidence.artifact ?? '', link.universeRef],
    );
    const old = groups.get(key);
    if (old) {
      old.evidence.push(link.evidence);
      continue;
    }
    groups.set(key, {
      key,
      output: link.output,
      analysis: link.analysis,
      result: link.result,
      universeRef: link.universeRef,
      artifact: link.evidence.artifact,
      evidence: [link.evidence],
    });
  }
  return [...groups.values()];
}

/** Literature evidence (a DOI, with or without a quote) a finding or insight cites. */
export function findingLiterature(finding: Insight): Evidence[] {
  return finding.evidence.filter((evidence) => Boolean(evidence.doi));
}

/** Insight refs cited by a decision's options, selected option first. */
export function decisionInsightPaths(decision: Decision, selectedId?: string): string[] {
  const selected = decision.options.find((option) => option.id === selectedId);
  return [
    ...new Set([
      ...(selected?.insights ?? []),
      ...decision.options.filter((option) => option.id !== selectedId).flatMap((option) => option.insights),
    ]),
  ];
}

/** The insights a decision's options cite, the option selected in `universeRef` first. */
export function decisionInsights(index: ResolvedAnalysisIndex, decision: Decision, universeRef?: string): Insight[] {
  const universe = universeRef ? index.elementByRef.get(universeRef) : undefined;
  const selected = universe?.collection === 'universes' ? universe.element.selection[decision.ref] : undefined;
  return decisionInsightPaths(decision, selected)
    .map((ref) => locateRecord(index, ref)?.record)
    .filter(isInsight);
}

/** Decisions anywhere in the document whose options cite this insight. */
export function informedDecisions(document: ResolvedAnalysis, insight: Insight): Decision[] {
  return document.analyses
    .flatMap((analysis) => analysis.decisions)
    .filter((decision) => decision.options.some((option) => option.insights.includes(insight.ref)));
}
