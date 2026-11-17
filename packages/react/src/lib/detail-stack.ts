/** Navigation state for record details: what a detail surface shows, and the stack that drives drill-down. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Analysis, Decision, Input, Insight, Output } from '@astra-spec/sdk/reports';

/** The records a detail can show; `model`'s `AstraRecord`, restated because `lib` cannot import `model`. */
type AstraRecord = Input | Decision | Output | Insight;

/** What a detail surface is showing: a record, or a paper (optionally focused on an insight). */
export type DetailEntry =
  | { kind: 'record'; ref: string; analysisKey: string; universeRef?: string | undefined }
  | { kind: 'paper'; doi: string; analysisKey: string; focusInsightRef?: string | undefined };

export function recordEntry(ref: string, analysisKey: string, universeRef?: string): DetailEntry {
  return { kind: 'record', ref, analysisKey, ...(universeRef === undefined ? {} : {universeRef}) };
}

export function paperEntry(doi: string, analysisKey: string, focusInsightRef?: string): DetailEntry {
  return { kind: 'paper', doi, analysisKey, ...(focusInsightRef ? { focusInsightRef } : {}) };
}

export function sameEntry(left: DetailEntry, right: DetailEntry): boolean {
  if (left.kind !== right.kind || left.analysisKey !== right.analysisKey) return false;
  return left.kind === 'record'
    ? left.ref === (right as Extract<DetailEntry, { kind: 'record' }>).ref && left.universeRef === (right as Extract<DetailEntry, { kind: 'record' }>).universeRef
    : left.doi === (right as Extract<DetailEntry, { kind: 'paper' }>).doi;
}

/** Opens a record, shown within the analysis that owns it; the shape every drill-down callback shares. */
export type OpenRecordHandler = (record: AstraRecord, analysis: Analysis, universeRef?: string) => void;

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
  openRecord: (record: AstraRecord, analysis: Analysis, universeRef?: string) => void;
  openPaper: (doi: string, analysis: Analysis, focusInsightRef?: string) => void;
  /** Pushes an entry on top of the current one (drill-down). */
  push: (entry: DetailEntry) => void;
  pushRecord: (record: AstraRecord, analysis: Analysis, universeRef?: string) => void;
  pushPaper: (doi: string, analysis: Analysis, focusInsightRef?: string) => void;
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
      openRecord: (record, analysis, universeRef) => { open(recordEntry(record.ref, analysis.key, universeRef)); },
      openPaper: (doi, analysis, focusInsightRef) => { open(paperEntry(doi, analysis.key, focusInsightRef)); },
      push,
      pushRecord: (record, analysis, universeRef) => { push(recordEntry(record.ref, analysis.key, universeRef)); },
      pushPaper: (doi, analysis, focusInsightRef) => { push(paperEntry(doi, analysis.key, focusInsightRef)); },
      back: () => { update((current) => current.slice(0, -1)); },
      close: () => { update(() => EMPTY); },
      set,
    };
  }, [stack, set, update]);
}
