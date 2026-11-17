import type { ProvenanceRecord, Status } from '@astra-spec/sdk/reports';
export interface OutputProvenanceData {
  status?: Status | undefined;
  /** A record the host loads separately; otherwise status.record is used. null means none was recorded. */
  record?: ProvenanceRecord | null | undefined;
  /** The host is still fetching the record: say so instead of "no recorded run". */
  loading?: boolean | undefined;
  error?: string | undefined;
}
