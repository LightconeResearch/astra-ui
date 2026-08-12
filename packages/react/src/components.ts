/**
 * The lightweight components layer: detail dialogs, cards, previews, and the
 * primitives beneath them — the pieces any host (including the publication
 * theme) can mount without pulling in the graph or inventory applications.
 * Pair with the `components.css` entry.
 */
export * from './context.js';
export * from './artifact-preview.js';
export * from './record-detail.js';
export * from './result-viewer.js';
export * from './shared.js';
export * from './ui.js';
export {
  DecisionDialog,
} from './full-inventory/DecisionsInventory.js';
export {
  FindingDialog,
} from './full-inventory/FindingsInventory.js';
export {
  InputDialog,
} from './full-inventory/InputsInventory.js';
export {
  InsightDetailDialog,
  InsightDetailTrigger,
} from './full-inventory/InsightDetailDialog.js';
export {
  InventoryArtifactPreview,
  inventoryFileExtension,
  inventoryFileName,
} from './full-inventory/InventoryArtifactPreview.js';
export * from './full-inventory/InventoryPrimitives.js';
export {
  InventoryProse,
  parseInventoryProse,
} from './full-inventory/InventoryProse.js';
export type { InventoryProseToken } from './full-inventory/InventoryProse.js';
export * from './full-inventory/InventoryRelations.js';
export {
  OutputDetail,
  OutputDialog,
} from './full-inventory/OutputsInventory.js';
export type { OutputDetailProps } from './full-inventory/OutputsInventory.js';
export { PaperPdfViewer } from './full-inventory/PaperPdfViewer.js';
export type {
  PaperPdfViewerProps,
  PaperQuoteFocusRequest,
} from './full-inventory/PaperPdfViewer.js';
export {
  PaperDialog,
  paperMetadataFromCitations,
  paperRecords,
} from './full-inventory/PapersInventory.js';
export type {
  InventoryPaper,
  InventoryPaperMetadata,
  InventoryPaperMetadataMap,
} from './full-inventory/PapersInventory.js';
export {
  citationTitleFromHtml,
  directCitationPdfUrl,
  doiHref,
  normalizeDoi,
} from './full-inventory/citationMetadata.js';
export {
  createInventoryModel,
  decisionEvidenceIds,
  getInventoryScope,
  inventoryDecisionInsights,
  inventoryInformedDecisions,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  inventoryScopeForRecord,
  inventoryScopesForView,
  resolveInventoryRecordReference,
  selectedOptionLabel,
} from './full-inventory/model.js';
export type {
  InventoryModel,
  InventoryRecordForKind,
  LocatedInventoryRecord,
} from './full-inventory/model.js';
export * from './types.js';
