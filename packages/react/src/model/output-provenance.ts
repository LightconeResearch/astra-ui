import type { ProvenanceRecord, Status } from '@astra-spec/sdk/reports';
export interface OutputProvenanceData {
  status?: Status | undefined;
  /** Override a record while loading it separately; otherwise status.record is used. */
  record?: ProvenanceRecord | null | undefined;
  error?: string | undefined;
}
