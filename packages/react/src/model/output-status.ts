import type { Result, Status, StatusReport } from '@astra-spec/sdk/reports';

/** The result an output is shown with, the universe it was selected in, and its SDK status. */
export interface OutputContext {
  result?: Result | undefined;
  universeRef?: string | undefined;
  status?: Status | undefined;
}

/** The status-report entry for the result an output is shown with; none without a result. */
export function resultStatus(statusReport: StatusReport | undefined, result: Result | undefined): Status | undefined {
  return result ? statusReport?.statuses[result.id] : undefined;
}
