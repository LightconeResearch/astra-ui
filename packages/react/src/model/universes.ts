import type { Analysis, ResolvedAnalysisIndex, Universe } from '@astra-spec/sdk/reports';

/**
 * Each reachable analysis's declaring parent, in the SDK's depth-first
 * declaration order from the root: a back-reference (a child declaring its
 * `parent`) reaches an analysis already visited and does not re-parent it.
 */
function declaringParents(index: ResolvedAnalysisIndex): Map<string, string> {
  const parents = new Map<string, string>();
  const visited = new Set<string>();
  const pending: [string, string | undefined][] = [['', undefined]];
  while (pending.length) {
    const [key, parent] = pending.pop() ?? ['', undefined];
    if (visited.has(key)) continue;
    visited.add(key);
    if (parent !== undefined) parents.set(key, parent);
    const declared = Object.values(index.analysisByKey.get(key)?.declares ?? {});
    for (let position = declared.length - 1; position >= 0; position -= 1) {
      const child = declared[position];
      if (child !== undefined) pending.push([child, key]);
    }
  }
  return parents;
}

/**
 * The universes that evaluate an analysis: its own, then its declaring
 * ancestors' (nearest first), which evaluate everything they declare, then any
 * other universe whose results build its outputs, whose selection covers its
 * decisions, or in which its findings' evidence is bound. A sub-analysis's own
 * universe evaluates nothing its parent declares, so it is not listed there.
 */
export function analysisUniverses(index: ResolvedAnalysisIndex, analysis: Analysis): Universe[] {
  const listed = new Set<string>();
  const universes: Universe[] = [];
  const add = (universe: Universe) => {
    if (listed.has(universe.ref)) return;
    listed.add(universe.ref);
    universes.push(universe);
  };
  const parents = declaringParents(index);
  const lineage = new Set<string>();
  for (let key: string | undefined = analysis.key; key !== undefined && !lineage.has(key); key = parents.get(key)) {
    lineage.add(key);
    index.analysisByKey.get(key)?.universes.forEach(add);
  }

  const relevant = new Set<string>();
  for (const output of analysis.outputs) {
    for (const result of index.resultsByOutput.get(output.ref) ?? []) {
      if (result.universe !== undefined) relevant.add(result.universe);
    }
  }
  for (const finding of analysis.findings) {
    for (const evidence of finding.evidence) {
      for (const binding of evidence.bindings ?? []) {
        if (binding.universe !== undefined) relevant.add(binding.universe);
      }
    }
  }
  for (const candidate of index.analysisByKey.values()) {
    for (const universe of candidate.universes) {
      if (relevant.has(universe.ref) || analysis.decisions.some((decision) => Object.hasOwn(universe.selection, decision.ref))) {
        add(universe);
      }
    }
  }
  return universes;
}

/** Names for universes listed together: the label, or the ref where two labels would read the same. */
export function universeTitles(universes: readonly Universe[]): string[] {
  const titles = universes.map((universe) => universe.label ?? universe.ref);
  return titles.map((title, position) =>
    titles.indexOf(title) === titles.lastIndexOf(title) ? title : `${title} (${universes[position]?.ref ?? ''})`,
  );
}
