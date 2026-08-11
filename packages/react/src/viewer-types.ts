import type {
  AstraRecordKind,
  ProjectViewModelV1,
  ResourceDescriptor,
  ViewModelDiagnostic,
} from '@astra-spec/sdk/view-model';

export const RUNTIME_OVERLAY_SCHEMA_VERSION = 'runtime-overlay.v1' as const;
export const VIEWER_SESSION_SCHEMA_VERSION = 'viewer-session.v1' as const;

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
  diagnostics: ViewModelDiagnostic[];
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

export interface ViewerOpenReference {
  kind: AstraRecordKind;
  id: string;
  canonicalPath?: string;
}

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
