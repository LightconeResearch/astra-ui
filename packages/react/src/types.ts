import type {
  ProjectRecordView,
  ProjectScopeView,
  ViewerDiagnostic,
  ViewerOpenReference,
} from '@lightcone-research/astra-ui-model';

export interface PaperOpenReference {
  kind: 'paper';
  doi: string;
}

export type InventoryOpenReference = ViewerOpenReference | PaperOpenReference;
export type InventoryDiagnostic = ViewerDiagnostic;
export type InventoryRecord = ProjectRecordView;
export type InventoryScope = ProjectScopeView;

export interface InventoryPaperMetadata {
  title?: string;
  authors?: string;
  pdfUrl?: string;
}

export type InventoryPaperMetadataMap = Record<string, InventoryPaperMetadata>;
