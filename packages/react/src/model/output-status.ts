import type { Result, Status } from '@astra-spec/sdk/reports';

/** The result an output is shown with, the universe it was selected in, and its SDK status. */
export interface OutputContext {
  result?: Result | undefined;
  universeRef?: string | undefined;
  status?: Status | undefined;
}
