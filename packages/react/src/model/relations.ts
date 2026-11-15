import {
  getResult,
  getEvidenceOutput,
  selectResult,
  type Analysis,
  type Decision,
  type Evidence,
  type Insight,
  type Output,
  type ResolvedAnalysis,
  type ResolvedAnalysisIndex,
  type Result,
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
}
export interface FindingEvidenceLink {
  evidence: Evidence;
  result?: Result | undefined;
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
interface DecisionDependency {
  ref: string;
  universeRef?: string | undefined;
  via: Map<string, LinkedRecord>;
}
function contextKey(ref: string, universeRef?: string): string {
  return JSON.stringify([ref, universeRef]);
}
function collectOutputDecisions(
  index: ResolvedAnalysisIndex,
  output: Output,
  universeRef?: string,
): DecisionDependency[] {
  const seed = outputResult(index, output, universeRef);
  const direct = new Set(output.decisions.map((ref) => contextKey(ref, seed?.universe ?? universeRef)));
  const decisions = new Map(
    output.decisions.map((ref) => [
      contextKey(ref, seed?.universe ?? universeRef),
      { ref, universeRef: seed?.universe ?? universeRef, via: new Map<string, LinkedRecord>() },
    ]),
  );
  const seenByRoute = new Map<string, Set<string>>();
  const queue: { id: string; via?: LinkedRecord | undefined }[] = (seed?.inputs ?? []).flatMap((source) =>
    source.result ? [{ id: source.result }] : [],
  );
  for (const entry of queue) {
    const result = index.resultById.get(entry.id);
    if (!result || result.id === seed?.id) continue;
    const via = entry.via ?? linkedRecord(index, result.output, result.universe),
      routeKey = contextKey(via.canonicalPath, via.universeRef);
    const seen = seenByRoute.get(routeKey) ?? new Set<string>();
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    seenByRoute.set(routeKey, seen);
    const found = index.elementByRef.get(result.output);
    if (found?.collection !== 'outputs') continue;
    for (const ref of found.element.decisions) {
      const key = contextKey(ref, result.universe);
      if (direct.has(key)) continue;
      const decision = decisions.get(key) ?? {
        ref,
        universeRef: result.universe,
        via: new Map<string, LinkedRecord>(),
      };
      decision.via.set(routeKey, via);
      decisions.set(key, decision);
    }
    queue.push(...result.inputs.flatMap((source) => (source.result ? [{ id: source.result, via }] : [])));
  }
  return [...decisions.values()];
}
/** Unique decision refs only. Use outputRelations for universe-specific selections or provenance. */
export function outputDecisionPaths(index: ResolvedAnalysisIndex, output: Output, universeRef?: string): string[] {
  return [...new Set(collectOutputDecisions(index, output, universeRef).map((decision) => decision.ref))];
}
/** Unique-ref route summary, intentionally without universe context. Contextual renderers use outputRelations. */
export function outputDecisionRoutes(
  index: ResolvedAnalysisIndex,
  output: Output,
  universeRef?: string,
): Map<string, Set<string>> {
  const routes = new Map<string, Set<string>>();
  for (const decision of collectOutputDecisions(index, output, universeRef)) {
    if (!decision.via.size) continue;
    const refs = routes.get(decision.ref) ?? new Set<string>();
    for (const via of decision.via.values()) refs.add(via.canonicalPath);
    routes.set(decision.ref, refs);
  }
  return routes;
}
/** Dependency identities include the effective universe; two pins to one output remain distinct. */
export function outputRelations(index: ResolvedAnalysisIndex, output: Output, universeRef?: string): OutputRelations {
  const result = outputResult(index, output, universeRef);
  const inputs = (result?.inputs ?? []).flatMap((source) => {
    const upstream = source.result ? index.resultById.get(source.result) : undefined;
    const ref = source.input ?? upstream?.output;
    return ref ? [linkedRecord(index, ref, upstream?.universe)] : [];
  });
  return {
    inputs: [...new Map(inputs.map((link) => [contextKey(link.canonicalPath, link.universeRef), link])).values()],
    decisions: collectOutputDecisions(index, output, universeRef).map((decision) => ({
      ...linkedRecord(index, decision.ref, decision.universeRef),
      ...(decision.via.size ? { via: [...decision.via.values()] } : {}),
    })),
  };
}
/** Effective citations remain distinct result IDs; switch evidence is never guessed by universe. */
export function findingEvidence(index: ResolvedAnalysisIndex, finding: Insight): FindingEvidenceLink[] {
  return finding.evidence.flatMap((evidence, evidenceIndex) => {
    if (!evidence.artifact && !evidence.cites) return [];
    const results = (evidence.cites ?? []).flatMap((id) => {
      const result = index.resultById.get(id);
      return result ? [result] : [];
    });
    if (!results.length) {
      const output = getEvidenceOutput(index, finding.ref, evidenceIndex);
      const found = output ? locateRecord(index, output.ref) : undefined;
      return [{ evidence, ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}) }];
    }
    return results.map((result) => {
      const found = locateRecord(index, result.output);
      return {
        evidence,
        result,
        ...(found?.kind === 'output' ? { output: found.record, analysis: found.analysis } : {}),
      };
    });
  });
}
export interface FindingEvidenceGroup {
  key: string;
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
          ? ['output', link.output.ref]
          : ['artifact', link.evidence.artifact ?? ''],
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
