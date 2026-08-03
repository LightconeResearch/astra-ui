export const PROJECT_VIEW_MODEL_SCHEMA_VERSION = 'project-view-model.v1' as const;
export const RUNTIME_OVERLAY_SCHEMA_VERSION = 'runtime-overlay.v1' as const;
export const VIEWER_SESSION_SCHEMA_VERSION = 'viewer-session.v1' as const;

export type ProjectViewModelSchemaVersion =
  typeof PROJECT_VIEW_MODEL_SCHEMA_VERSION;

export type AstraRecordKind =
  | 'input'
  | 'decision'
  | 'output'
  | 'finding'
  | 'prior_insight';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface ViewerDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  canonicalPath?: string;
  sourceUri?: string;
}

export interface ProjectRevision {
  /** Revision of astra.yaml and every resolved child analysis. */
  analysis: string;
  /** Revision of the explicit universe selection, when one is present. */
  selection?: string;
}

export interface ProjectIdentity {
  id: string;
  name: string;
  description?: string;
  astraVersion?: string;
}

export type UniverseSelectionSource =
  | 'explicit'
  | 'default'
  | 'none'
  | 'unknown';

export interface ProjectSelection {
  universeId?: string;
  availableUniverses: string[];
  decisions: Record<string, string>;
  source: UniverseSelectionSource;
}

export interface ProjectScopeView {
  id: string;
  /** Canonical analysis path. The root conventionally uses `root`. */
  canonicalPath: string;
  name: string;
  description?: string;
  parentId?: string;
  childIds: string[];
  recordIds: string[];
  sourceUri?: string;
}

export interface RecipeDescriptor {
  command?: string;
  container?: string;
}

export interface DecisionOptionView {
  id: string;
  label?: string;
  description?: string;
  selected: boolean;
  excluded?: boolean;
  exclusionReason?: string;
  insightRecordIds?: string[];
}

export interface EvidenceDescriptor {
  artifactRecordId?: string;
  doi?: string;
  quote?: string;
  page?: number;
}

export type RecordRelationKind =
  | 'contains'
  | 'depends_on'
  | 'parameterized_by'
  | 'informed_by'
  | 'evidenced_by'
  | 'aliases'
  | 'derived_from';

export interface RecordRelation {
  kind: RecordRelationKind;
  targetRecordId: string;
  direct?: boolean;
  label?: string;
}

export interface MetricValue {
  value?: number | string;
  uncertainty?: number | string;
  unit?: string;
  label?: string;
}

export interface BaseRecordView {
  /** Stable within one project revision; not a global citation identifier. */
  id: string;
  /** The authored ASTRA id before host-safe project/scope namespacing. */
  localId: string;
  canonicalPath: string;
  scopeId: string;
  kind: AstraRecordKind;
  label?: string;
  description?: string;
  sourceUri?: string;
  active?: boolean;
  tags?: string[];
  relations: RecordRelation[];
}

export interface InputRecordView extends BaseRecordView {
  kind: 'input';
  inputType?: string;
  source?: string;
  reference?: string;
}

export interface DecisionRecordView extends BaseRecordView {
  kind: 'decision';
  rationale?: string;
  selectedOptionId?: string;
  options: DecisionOptionView[];
}

export type OutputType =
  | 'figure'
  | 'table'
  | 'metric'
  | 'dataset'
  | 'report'
  | 'file'
  | 'other';

export interface OutputRecordView extends BaseRecordView {
  kind: 'output';
  outputType: OutputType;
  recipe?: RecipeDescriptor;
  /** References descriptors; it never contains file paths, URLs, or bytes. */
  resourceIds: string[];
  metric?: MetricValue;
}

export interface FindingRecordView extends BaseRecordView {
  kind: 'finding';
  claim?: string;
  notes?: string;
  evidence: EvidenceDescriptor[];
}

export interface PriorInsightRecordView extends BaseRecordView {
  kind: 'prior_insight';
  claim?: string;
  notes?: string;
  evidence: EvidenceDescriptor[];
}

export type ProjectRecordView =
  | InputRecordView
  | DecisionRecordView
  | OutputRecordView
  | FindingRecordView
  | PriorInsightRecordView;

export type ResourceKind =
  | 'figure'
  | 'table'
  | 'metric'
  | 'dataset'
  | 'document'
  | 'other';

export type ResourceAvailability =
  | 'available'
  | 'missing'
  | 'stale'
  | 'unknown';

export type ResourceAssociationSource =
  | 'declared'
  | 'materialized'
  | 'inferred';

/** Serializable metadata only. Hosts keep paths, URLs, credentials, and bytes. */
export interface ResourceDescriptor {
  id: string;
  kind: ResourceKind;
  mediaType?: string;
  fileName?: string;
  byteSize?: number;
  revision?: string;
  availability: ResourceAvailability;
  source: ResourceAssociationSource;
  outputRecordId?: string;
}

export interface ProjectViewModelV1 {
  schemaVersion: typeof PROJECT_VIEW_MODEL_SCHEMA_VERSION;
  revision: ProjectRevision;
  project: ProjectIdentity;
  selection: ProjectSelection;
  scopes: ProjectScopeView[];
  records: ProjectRecordView[];
  resources: ResourceDescriptor[];
  diagnostics: ViewerDiagnostic[];
}

export type MaterializationStatus =
  | 'available'
  | 'missing'
  | 'stale'
  | 'running'
  | 'failed'
  | 'unknown';

export interface OutputMaterialization {
  outputRecordId: string;
  status: MaterializationStatus;
  resourceIds: string[];
  message?: string;
}

/** Optional retrospective execution data. This is not part of ASTRA. */
export interface RuntimeOverlayV1 {
  schemaVersion: typeof RUNTIME_OVERLAY_SCHEMA_VERSION;
  analysisRevision: string;
  universeId?: string;
  materializationRevision: string;
  outputs: Record<string, OutputMaterialization>;
  resources: ResourceDescriptor[];
  diagnostics: ViewerDiagnostic[];
}

export interface TablePreview {
  kind: 'table';
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
  totalRows?: number;
  totalColumns?: number;
  truncated?: boolean;
}

export interface ImagePreview {
  kind: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface MetricPreview {
  kind: 'metric';
  value: number | string;
  uncertainty?: number | string;
  unit?: string;
  label?: string;
}

export interface TextPreview {
  kind: 'text';
  text: string;
  language?: string;
  truncated?: boolean;
}

export interface UnavailablePreview {
  kind: 'unavailable';
  reason?: string;
}

export type ResourcePreview =
  | TablePreview
  | ImagePreview
  | MetricPreview
  | TextPreview
  | UnavailablePreview;

export interface PreviewRequest {
  maxRows?: number;
  maxColumns?: number;
  maxBytes?: number;
  signal?: AbortSignal;
}

export interface ViewerCapabilities {
  preview: boolean;
  download: boolean;
  openSource: boolean;
  changeUniverse: boolean;
  execution: boolean;
  externalNavigation: boolean;
  chatReference: boolean;
}

export type ViewerOpenReference = {
  kind: AstraRecordKind;
  id: string;
  canonicalPath?: string;
  /** Compatibility spelling used by the first Jupyter prototype. */
  path?: string;
};

export type ViewerChange =
  | { kind: 'analysis'; revision: string; model?: ProjectViewModelV1 }
  | { kind: 'selection'; revision: string; model?: ProjectViewModelV1 }
  | { kind: 'materialization'; revision: string; runtime?: RuntimeOverlayV1 }
  | { kind: 'resource'; revision: string; resourceIds: string[] };

export interface ViewerHost {
  capabilities: ViewerCapabilities;
  getPreview?: (
    resourceId: string,
    request: PreviewRequest,
  ) => Promise<ResourcePreview>;
  getDownloadUrl?: (resourceId: string) => Promise<string>;
  openSource?: (recordId: string) => void | Promise<void>;
  openExternal?: (url: string) => void;
  changeUniverse?: (universeId: string) => void | Promise<void>;
  runOutput?: (recordId: string) => void | Promise<void>;
  insertChatReference?: (reference: ViewerOpenReference) => void | Promise<void>;
  subscribe?: (listener: (change: ViewerChange) => void) => () => void;
}

export interface ViewerSessionV1 {
  schemaVersion: typeof VIEWER_SESSION_SCHEMA_VERSION;
  model: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  capabilities: ViewerCapabilities;
}
