import type { ResolvedOutput } from '@astra-spec/sdk';

/**
 * Execution status supplied by the host, separate from the ASTRA document: the
 * document declares what an analysis produces, the host knows what has actually
 * been run. `detail` explains the state in the host's own words.
 */
export interface OutputStatus {
  state: 'unmaterialized' | 'outdated' | 'materialized';
  detail?: string | undefined;
}

/** Host lookup for one output's execution status; `undefined` means unknown. */
export type OutputStatusLookup = (output: ResolvedOutput) => OutputStatus | undefined;
