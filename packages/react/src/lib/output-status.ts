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

/** One 16×16 glyph per state, so every surface that draws a status draws the same mark. */
export const outputStatusIconPath: Record<OutputStatus['state'], string> = {
  materialized: 'm3.5 8 3 3 6-6',
  outdated: 'M12.5 5A5 5 0 1 0 13 9M12.5 1.5V5H9',
  unmaterialized: 'm4.5 4.5 7 7m0-7-7 7',
};
