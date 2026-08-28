/** ASTRA-aware components: one detail body and one dialog per record kind (input, output, decision, finding, prior insight) plus papers, the RecordDialog router, and the detail stack. */
export { recordEntry, paperEntry, sameEntry } from './detail-entry.js';
export type { DetailEntry } from './detail-entry.js';
export { useDetailStack } from './use-detail-stack.js';
export type { DetailStack, DetailStackOptions } from './use-detail-stack.js';
export { relationItemForRecord, relationItemsForLinks } from './relation-items.js';
export type { OpenRecordHandler } from './relation-items.js';
export { OutputDetail, OutputDialogActions, OutputPreview, useOutputExpanded } from './output-detail.js';
export type { OutputDetailProps, OutputDialogActionsProps, OutputPreviewProps } from './output-detail.js';
export { OutputDialog } from './output-dialog.js';
export type { OutputDialogProps } from './output-dialog.js';
export { DecisionDetail, DecisionDialog } from './decision-detail.js';
export type { DecisionDetailProps, DecisionDialogProps } from './decision-detail.js';
export { FindingDetail, FindingDialog } from './finding-detail.js';
export type { FindingDetailProps, FindingDialogProps } from './finding-detail.js';
export { InputDetail, InputDialog, inputSourceLabel } from './input-detail.js';
export type { InputDetailProps, InputDialogProps } from './input-detail.js';
export { InsightDetail, InsightDialog, primaryLiteratureEvidence } from './insight-detail.js';
export type { InsightDetailProps, InsightDialogProps } from './insight-detail.js';
export { InsightEvidenceTitle, InsightTrigger } from './insight-trigger.js';
export type { InsightEvidenceTitleProps, InsightTriggerProps } from './insight-trigger.js';
export { PaperDetail, PaperDialog, PaperDialogActions } from './paper-detail.js';
export type { PaperDetailProps, PaperDialogActionsProps, PaperDialogProps, PaperRenderOptions, PaperRenderer } from './paper-detail.js';
export { RecordDialog } from './record-dialog.js';
export type { RecordDialogProps } from './record-dialog.js';
export {
  ArtifactPreview,
  metricPreviewFromJson,
  tablePreviewFromDelimited,
  tablePreviewFromRows,
} from './artifact-preview.js';
export type {
  ArtifactPreviewData,
  ArtifactPreviewProps,
  ArtifactRenderOptions,
  ArtifactRenderer,
  DelimitedPreviewOptions,
  ImagePreviewData,
  LoadingPreviewData,
  MetricPreviewData,
  TablePreviewData,
  TextPreviewData,
  UnavailablePreviewData,
} from './artifact-preview.js';
