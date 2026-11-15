import type { Output, Result, Status } from '@astra-spec/sdk/reports';
/** Status is the public SDK report value, including separate byte availability. */
export type OutputStatus = Status;
export type OutputStatusLookup = (output: Output, result?: Result) => Status | undefined;
export interface OutputContext {
  result?: Result | undefined;
  universeRef?: string | undefined;
  status?: Status | undefined;
}
