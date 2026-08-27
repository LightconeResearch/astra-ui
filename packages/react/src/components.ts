/** Controlled primitives, detail dialogs, and render slots. */
export * from './artifact-preview.js';
export * from './ui.js';
export {
  DecisionDialog,
} from './full-inventory/DecisionsInventory.js';
export type { DecisionDialogProps } from './full-inventory/DecisionsInventory.js';
export {
  FindingDialog,
} from './full-inventory/FindingsInventory.js';
export type { FindingDialogProps, FindingEvidenceLink } from './full-inventory/FindingsInventory.js';
export {
  InputDialog,
} from './full-inventory/InputsInventory.js';
export type { InputDialogProps } from './full-inventory/InputsInventory.js';
export {
  InsightDetailDialog,
  InsightDetailTrigger,
} from './full-inventory/InsightDetailDialog.js';
export type {
  InsightDetailDialogProps,
  InsightDetailTriggerProps,
} from './full-inventory/InsightDetailDialog.js';
export * from './full-inventory/InventoryPrimitives.js';
export {
  InventoryProse,
} from './full-inventory/InventoryProse.js';
export type { InventoryProseProps, TextRenderer } from './full-inventory/InventoryProse.js';
export * from './full-inventory/InventoryRelations.js';
export {
  OutputDetail,
  OutputDialog,
} from './full-inventory/OutputsInventory.js';
export type {
  LinkedRecord,
  OutputDetailProps,
  OutputDialogProps,
  OutputRelations,
} from './full-inventory/OutputsInventory.js';
export {
  PaperDialog,
  collectInventoryPapers,
} from './full-inventory/PapersInventory.js';
export type {
  InventoryPaper,
  InventoryPaperMetadata,
  InventoryPaperMetadataMap,
  PaperDialogProps,
  PaperFocusEvidence,
  PaperRenderer,
  PaperRenderOptions,
} from './full-inventory/PapersInventory.js';
export {
  doiHref,
} from './full-inventory/citationMetadata.js';
