/** Machinery behind the elements: class names, labels, navigation state, prose rendering, preview data, and the pdf.js contract. */
export { cn } from './cn.js';
export { LabelsProvider, defaultLabels, mergeLabels, useLabels } from './labels.js';
export type { AstraLabelOverrides, AstraLabels, LabelsProviderProps } from './labels.js';
export { paperEntry, recordEntry, sameEntry, useDetailStack } from './detail-stack.js';
export type { DetailEntry, DetailStack, DetailStackOptions, OpenRecordHandler } from './detail-stack.js';
export { parseProse, renderProse } from './prose.js';
export type { ProseContext, ProseField, ProseMathMacros, ProseRenderOptions, ProseToken, TextRenderer } from './prose.js';
export { metricPreviewFromJson, tablePreviewFromDelimited, tablePreviewFromRows } from './preview-data.js';
export type {
  ArtifactPreviewData,
  DelimitedPreviewOptions,
  ImagePreviewData,
  LoadingPreviewData,
  MetricPreviewData,
  TablePreviewData,
  TextPreviewData,
  UnavailablePreviewData,
} from './preview-data.js';
export { useOutputExpanded } from './use-output-expanded.js';
export { pdfJsWithWorker } from './pdf-runtime.js';
export type { PdfJs, PdfJsLoader, PdfJsWorkerModule } from './pdf-runtime.js';
