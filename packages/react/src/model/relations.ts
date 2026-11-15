import {
  getResult,
  getEvidenceOutput,
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
export interface LinkedRecord {
  canonicalPath: string;
  universeRef?: string | undefined;
  record?: AstraRecord | undefined;
  analysis?: Analysis | undefined;
}
export interface OutputRelations {
  inputs: LinkedRecord[];
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
export function linkedRecord(index: ResolvedAnalysisIndex, canonicalPath: string, universeRef?: string): LinkedRecord {
  const found = locateRecord(index, canonicalPath);
  return { canonicalPath, universeRef, ...(found ? { record: found.record, analysis: found.analysis } : {}) };
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
      if (link) group.via.set(contextKey(link.canonicalPath, link.universeRef), link);
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
    const found = index.elementByRef.get(link.canonicalPath);
    return found?.collection === 'switches' ? [found.element] : [];
  });
  return {
    inputs: [...new Map(inputs.map((link) => [contextKey(link.canonicalPath, link.universeRef), link])).values()],
    decisions: decisionLinks(index, output, universeRef),
    ...(switches.length ? { switches: [...new Map(switches.map((value) => [value.ref, value])).values()] } : {}),
  };
}
/** Bindings select the evaluation context before the UI looks up concrete report elements. */
export function findingEvidence(
  index: ResolvedAnalysisIndex,
  finding: Insight,
  universeRef?: string,
): FindingEvidenceLink[] {
  return finding.evidence.flatMap((evidence, position) => {
    const bindings = getEvidenceBindings(index, finding.ref, position, universeRef);
    if (bindings !== undefined)
      return bindings.map((binding) => {
        const found = binding.output ? locateRecord(index, binding.output) : undefined;
        return {
          evidence,
          universeRef: binding.output ? binding.target_universe : binding.universe,
          result: binding.result ? index.resultById.get(binding.result) : undefined,
          ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}),
        };
      });
    // Older report payloads have no bindings. Keep their aggregate citations and concrete-output identity fallback.
    if (!evidence.artifact && !evidence.cites) return [];
    const results = (evidence.cites ?? []).flatMap((id) => {
      const result = index.resultById.get(id);
      return result ? [result] : [];
    });
    if (!results.length) {
      const output = getEvidenceOutput(index, finding.ref, position);
      const found = output ? locateRecord(index, output.ref) : undefined;
      return [{ evidence, ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}) }];
    }
    return results.map((result) => {
      const found = locateRecord(index, result.output);
      return {
        evidence,
        result,
        universeRef: result.universe,
        ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}),
      };
    });
  });
}
export interface FindingEvidenceGroup {
  key: string;
  universeRef?: string | undefined;
  output?: Output | undefined;
  analysis?: Analysis | undefined;
  result?: Result | undefined;
  artifact?: string | undefined;
  evidence: Evidence[];
}
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
export function findingLiterature(finding: Insight): Evidence[] {
  return finding.evidence.filter((evidence) => Boolean(evidence.doi));
}
export function decisionInsightPaths(decision: Decision, selectedId?: string): string[] {
  const selected = decision.options.find((option) => option.id === selectedId);
  return [
    ...new Set([
      ...(selected?.insights ?? []),
      ...decision.options.filter((option) => option.id !== selectedId).flatMap((option) => option.insights),
    ]),
  ];
}
export function decisionInsights(index: ResolvedAnalysisIndex, decision: Decision, universeRef?: string): Insight[] {
  const universe = universeRef ? index.elementByRef.get(universeRef) : undefined;
  const selected = universe?.collection === 'universes' ? universe.element.selection[decision.ref] : undefined;
  return decisionInsightPaths(decision, selected)
    .map((ref) => locateRecord(index, ref)?.record)
    .filter(isInsight);
}
export function informedDecisions(document: ResolvedAnalysis, insight: Insight): Decision[] {
  return document.analyses
    .flatMap((analysis) => analysis.decisions)
    .filter((decision) => decision.options.some((option) => option.insights.includes(insight.ref)));
}
