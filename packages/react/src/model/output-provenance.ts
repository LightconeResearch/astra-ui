import type { OutputStatus } from './output-status.js';

/** Recorded execution metadata supplied by the host, independent of the current recipe. */
export interface OutputRun {
  finishedAt: string;
  gitRevision: string;
  recipe: string;
  environment: string;
  inputVersions: Readonly<Record<string, string>>;
  cliVersion: string;
}

export interface OutputProvenanceData {
  status?: OutputStatus | undefined;
  /** null means the host found no recorded run; undefined means it has not loaded. */
  run?: OutputRun | null | undefined;
  error?: string | undefined;
}
