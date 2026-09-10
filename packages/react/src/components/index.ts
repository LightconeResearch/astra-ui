/** ASTRA-aware components: one detail body and dialog per record kind, papers and their PDF reader, compact previews, and the RecordDialog router. */
export { OutputDetail, OutputDialogActions, OutputPreview } from './output-detail.js';
export type { OutputDetailProps, OutputDialogActionsProps, OutputPreviewProps } from './output-detail.js';
export { OutputDialog } from './output-dialog.js';
export type { OutputDialogProps } from './output-dialog.js';
export { DecisionDetail, DecisionDialog } from './decision-detail.js';
export type { DecisionDetailProps, DecisionDialogProps } from './decision-detail.js';
export { FindingDetail, FindingDialog } from './finding-detail.js';
export type { FindingDetailProps, FindingDialogProps } from './finding-detail.js';
export { InputDetail, InputDialog } from './input-detail.js';
export type { InputDetailProps, InputDialogProps } from './input-detail.js';
export { InsightDetail, InsightDialog } from './insight-detail.js';
export type { InsightDetailProps, InsightDialogProps } from './insight-detail.js';
export { InsightEvidenceTitle, InsightTrigger } from './insight-trigger.js';
export type { InsightEvidenceTitleProps, InsightTriggerProps } from './insight-trigger.js';
export { PaperDetail, PaperDialog, PaperDialogActions } from './paper-detail.js';
export type { PaperDetailProps, PaperDialogActionsProps, PaperDialogProps, OpenPaperFileHandler } from './paper-detail.js';
export { RecordDialog } from './record-dialog.js';
export type { RecordDialogProps } from './record-dialog.js';
export { RecordPreview } from './record-preview.js';
export type {
  RecordPreviewCitationContext,
  RecordPreviewCitationRenderer,
  RecordPreviewEntry,
  RecordPreviewProps,
  RecordPreviewReference,
  RecordPreviewReferenceRenderer,
  RecordPreviewTarget,
} from './record-preview.js';
export { ArtifactPreview } from './artifact-preview.js';
export type { ArtifactPreviewProps, ArtifactRenderOptions, ArtifactRenderer } from './artifact-preview.js';

export { PaperPdfViewer } from './paper-pdf-viewer.js';
export type { PaperPdfViewerProps, PdfLoadState, PdfPassage } from './paper-pdf-viewer.js';

export { OutputCard } from './output-card.js';
export type { OutputCardProps } from './output-card.js';
export { OutputEntry } from './output-entry.js';
export type { OutputEntryProps } from './output-entry.js';
