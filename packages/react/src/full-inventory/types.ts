export type InventoryScalar = string | number | boolean | null;

export interface InventoryEvidence {
  artifact?: string | undefined;
  doi?: string | undefined;
  quote?: string | undefined;
  page?: number | undefined;
}

export interface InventoryRecipe {
  command?: string | undefined;
  container?: string | undefined;
}

export interface InventoryTableData {
  headers: string[];
  rows: InventoryScalar[][];
}

export interface InventoryTablePreview extends InventoryTableData {
  total_rows?: number | undefined;
  total_columns?: number | undefined;
  serialized_bytes?: number | undefined;
  truncated?: boolean | undefined;
  cells_truncated?: boolean | undefined;
}

export interface InventoryMetric {
  value?: string | number | undefined;
  uncertainty?: string | number | undefined;
  error?: string | number | undefined;
  unit?: string | undefined;
  units?: string | undefined;
  label?: string | undefined;
}

export interface InventoryRootInput {
  id: string;
  label?: string | undefined;
}

export interface InventoryDecisionDependency {
  id: string;
  label?: string | undefined;
  via?: string | undefined;
  selection?: string | undefined;
}

export type InventoryKind =
  | 'analysis'
  | 'input'
  | 'decision'
  | 'output'
  | 'finding'
  | 'prior_insight';

export interface InventoryRecordReference {
  kind: Exclude<InventoryKind, 'analysis'>;
  id: string;
  path?: string | undefined;
}

/** Papers are derived from prior-insight DOI evidence, not ASTRA records. */
export interface InventoryPaperReference {
  kind: 'paper';
  doi: string;
}

/** Any detail target the shared inventory dialog stack can open directly. */
export type InventoryOpenReference =
  | InventoryRecordReference
  | InventoryPaperReference;

export interface InventoryDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string | undefined;
}

/**
 * Host-neutral convenience view of the record vocabulary consumed by the
 * full inventory. Hosts adapt their canonical model at this boundary; the UI
 * never parses astra.yaml or reads files itself.
 */
export interface InventoryRecord {
  /** Canonical ProjectViewModel record id, when projected from that model. */
  modelId?: string | undefined;
  id: string;
  path: string;
  kind: Exclude<InventoryKind, 'analysis'>;
  label?: string | undefined;
  description?: string | undefined;
  type?: string | undefined;
  tags?: string[] | undefined;
  source?: string | undefined;
  ref?: string | undefined;
  from?: string | undefined;
  when?: unknown | undefined;
  active?: boolean | undefined;
  selected?: string | undefined;
  options?: Record<string, string | undefined>;
  option_insights?: Record<string, string[] | undefined>;
  rationale?: string | undefined;
  claim?: string | undefined;
  notes?: string | undefined;
  scope?: string | undefined;
  doi?: string | undefined;
  quote?: string | undefined;
  /** Compatibility projection of the selected evidence location. */
  page?: number | undefined;
  resolved_path?: string | undefined;
  recipe?: InventoryRecipe | undefined;
  inputs?: string[] | undefined;
  decisions?: string[] | undefined;
  evidence?: InventoryEvidence[] | undefined;
  inputs_root?: InventoryRootInput[] | undefined;
  decisions_transitive?: InventoryDecisionDependency[] | undefined;
  table_data?: InventoryTableData | undefined;
  table_preview?: InventoryTablePreview | undefined;
  table_rows_total?: number | undefined;
  table_columns_total?: number | undefined;
  table_preview_omitted?: 'project_size_budget' | undefined;
  metric?: InventoryMetric | undefined;
  resourceIds?: string[] | undefined;
  resultPreview?: string | undefined;
}

type InventoryRecordOfKind<Kind extends InventoryRecord['kind']> =
  Omit<InventoryRecord, 'kind'> & { kind: Kind };

export type InventoryOutputRecord = InventoryRecordOfKind<'output'>;
export type InventoryInputRecord = InventoryRecordOfKind<'input'>;
export type InventoryDecisionRecord = InventoryRecordOfKind<'decision'>;
export type InventoryFindingRecord = InventoryRecordOfKind<'finding'>;
export type InventoryInsightRecord = InventoryRecordOfKind<'prior_insight'>;

export interface InventoryScope {
  id: string;
  path: string;
  name: string;
  parent?: string | undefined;
  children: string[];
  records: InventoryRecord[];
}

/** UI-facing snapshot; MySTRA's project payload is adapted at the theme boundary. */
export interface InventorySnapshot {
  version: number;
  fixture?: {
    label: string;
    source: string;
    frozen: string;
    disclaimer: string;
  };
  analysis: {
    id: string;
    name: string;
    description?: string | undefined;
  };
  scopes: InventoryScope[];
  diagnostics?: InventoryDiagnostic[] | undefined;
}
