import type { ResolvedOutput } from '@astra-spec/sdk';

/**
 * Execution status supplied by the host, separate from the ASTRA document: the
 * document declares what an analysis produces, the host knows what has actually
 * been run. The states are the ones `lc status` reports, so a marker in the UI
 * and a line in the terminal name the same thing: `current` is exactly what the
 * spec asks for, `behind` still is but the environment moved since, and `stale`
 * contradicts the project (definition or input changed, hand-edited, or never
 * materialized). `detail` is the host's own reason, as `lc status` prints it.
 */
export interface OutputStatus {
  state: 'current' | 'behind' | 'stale';
  detail?: string | undefined;
}

/** Host lookup for one output's execution status; `undefined` means unknown. */
export type OutputStatusLookup = (output: ResolvedOutput) => OutputStatus | undefined;
