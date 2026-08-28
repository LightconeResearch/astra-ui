import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResolvedAnalysisNode, ResolvedRecord } from '@astra-spec/sdk';
import { paperEntry, recordEntry, type DetailEntry } from './detail-entry.js';

export interface DetailStackOptions {
  /** Controlled stack; pair with `onChange`. */
  value?: readonly DetailEntry[] | undefined;
  defaultValue?: readonly DetailEntry[] | undefined;
  onChange?: ((next: DetailEntry[]) => void) | undefined;
}

export interface DetailStack {
  stack: readonly DetailEntry[];
  active: DetailEntry | undefined;
  previous: DetailEntry | undefined;
  /** Replaces the stack with a single entry. */
  open: (entry: DetailEntry) => void;
  openRecord: (record: ResolvedRecord, analysis: ResolvedAnalysisNode) => void;
  openPaper: (doi: string, analysis: ResolvedAnalysisNode, focusInsightPath?: string) => void;
  /** Pushes an entry on top of the current one (drill-down). */
  push: (entry: DetailEntry) => void;
  pushRecord: (record: ResolvedRecord, analysis: ResolvedAnalysisNode) => void;
  pushPaper: (doi: string, analysis: ResolvedAnalysisNode, focusInsightPath?: string) => void;
  back: () => void;
  close: () => void;
  set: (next: readonly DetailEntry[]) => void;
}

const EMPTY: DetailEntry[] = [];

/**
 * Headless navigation state for record details: a stack of entries with
 * open/push/back/close. Works controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue`), like a React input.
 */
export function useDetailStack({ value, defaultValue, onChange }: DetailStackOptions = {}): DetailStack {
  const [internal, setInternal] = useState<readonly DetailEntry[]>(defaultValue ?? EMPTY);
  const controlled = value !== undefined;
  const stack = controlled ? value : internal;
  const latest = useRef(stack);
  useEffect(() => { latest.current = stack; });

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Uncontrolled updates read the latest stack (not the render-time one) so
  // two calls in the same tick compose, and notify the host once per change.
  // Controlled updates are proposals computed from the value the host last
  // rendered; the host decides, like a controlled input.
  const update = useCallback((compute: (current: readonly DetailEntry[]) => readonly DetailEntry[]) => {
    const next = [...compute(latest.current)];
    if (!controlled) {
      latest.current = next;
      setInternal(next);
    }
    onChangeRef.current?.(next);
  }, [controlled]);
  const set = useCallback((next: readonly DetailEntry[]) => { update(() => next); }, [update]);

  return useMemo<DetailStack>(() => {
    const open = (entry: DetailEntry) => { update(() => [entry]); };
    const push = (entry: DetailEntry) => { update((current) => [...current, entry]); };
    return {
      stack,
      active: stack.at(-1),
      previous: stack.length > 1 ? stack.at(-2) : undefined,
      open,
      openRecord: (record, analysis) => { open(recordEntry(record.canonicalPath, analysis.canonicalPath)); },
      openPaper: (doi, analysis, focusInsightPath) => { open(paperEntry(doi, analysis.canonicalPath, focusInsightPath)); },
      push,
      pushRecord: (record, analysis) => { push(recordEntry(record.canonicalPath, analysis.canonicalPath)); },
      pushPaper: (doi, analysis, focusInsightPath) => { push(paperEntry(doi, analysis.canonicalPath, focusInsightPath)); },
      back: () => { update((current) => current.slice(0, -1)); },
      close: () => { update(() => EMPTY); },
      set,
    };
  }, [stack, set, update]);
}
