import type {
  AstraRecordKind,
  DecisionRecordView,
  FindingRecordView,
  InputRecordView,
  OutputRecordView,
  PriorInsightRecordView,
  ProjectRecordView,
  ProjectScopeView,
  ViewModelDiagnostic,
} from '@astra-spec/sdk/view-model';
import type { ViewerOpenReference } from './viewer-types.js';

export interface PaperOpenReference {
  kind: 'paper';
  doi: string;
}

export type InventoryOpenReference = ViewerOpenReference | PaperOpenReference;
export type InventoryDiagnostic = ViewModelDiagnostic;
export type InventoryKind = AstraRecordKind | 'analysis';
export type InventoryRecord = ProjectRecordView;
export type InventoryScope = ProjectScopeView;
export type InventoryOutputRecord = OutputRecordView;
export type InventoryInputRecord = InputRecordView;
export type InventoryDecisionRecord = DecisionRecordView;
export type InventoryFindingRecord = FindingRecordView;
export type InventoryInsightRecord = PriorInsightRecordView;

export interface InventoryPaperMetadata {
  title?: string;
  authors?: string;
  pdfUrl?: string;
}

export type InventoryPaperMetadataMap = Record<string, InventoryPaperMetadata>;
