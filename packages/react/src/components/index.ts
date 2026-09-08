/** ASTRA-aware components: compact previews, one detail body and dialog per record kind, papers, the RecordDialog router, and the detail stack. */
export { recordEntry, paperEntry, sameEntry, useDetailStack } from '../lib/detail-stack.js';
export type { DetailEntry, DetailStack, DetailStackOptions, OpenRecordHandler } from '../lib/detail-stack.js';
export { relationItemForRecord, relationItemsForLinks } from './relation-items.js';
export { OutputDetail, OutputDialogActions, OutputPreview } from './output-detail.js';
export { useOutputExpanded } from '../lib/use-output-expanded.js';
export type { OutputDetailProps, OutputDialogActionsProps, OutputPreviewProps } from './output-detail.js';
export { OutputDialog } from './output-dialog.js';
export type { OutputDialogProps } from './output-dialog.js';
export { DecisionDetail, DecisionDialog } from './decision-detail.js';
export type { DecisionDetailProps, DecisionDialogProps } from './decision-detail.js';
export { FindingDetail, FindingDialog } from './finding-detail.js';
export type { FindingDetailProps, FindingDialogProps } from './finding-detail.js';
export { InputDetail, InputDialog } from './input-detail.js';
export { inputSourceLabel } from '../model/records.js';
export type { InputDetailProps, InputDialogProps } from './input-detail.js';
export { InsightDetail, InsightDialog } from './insight-detail.js';
export { primaryLiteratureEvidence } from '../model/papers.js';
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
export { metricPreviewFromJson, tablePreviewFromDelimited, tablePreviewFromRows } from '../lib/preview-data.js';
export type {
  ArtifactPreviewData,
  DelimitedPreviewOptions,
  ImagePreviewData,
  LoadingPreviewData,
  MetricPreviewData,
  TablePreviewData,
  TextPreviewData,
  UnavailablePreviewData,
} from '../lib/preview-data.js';

export { PaperPdfViewer } from './paper-pdf-viewer.js';
export type { PaperPdfViewerProps, PdfLoadState, PdfPassage } from './paper-pdf-viewer.js';
export { pdfJsWithWorker } from '../lib/pdf-runtime.js';
export type { PdfJs, PdfJsLoader } from '../lib/pdf-runtime.js';
