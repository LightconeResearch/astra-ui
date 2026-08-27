/** Pure, React-free derivations over the SDK's resolved model. */
export { analysisTitle, countLabel, isInsight, isVisualOutput, recordTitle, selectedOptionLabel } from './records.js';
export { createInventoryIndex, locateRecord } from './inventory-index.js';
export type { InventoryIndex, LocatedRecord } from './inventory-index.js';
export {
  decisionInsightPaths,
  decisionInsights,
  findingEvidence,
  informedDecisions,
  linkedRecord,
  outputRelations,
} from './relations.js';
export type { FindingEvidenceLink, LinkedRecord, OutputRelations } from './relations.js';
export {
  analysesForPaperView,
  collectInventoryPapers,
  findPaper,
  insightDois,
  paperEvidence,
  paperMetadataFor,
} from './papers.js';
export type {
  InventoryPaper,
  InventoryPaperMetadata,
  InventoryPaperMetadataMap,
  PaperFetchStatus,
  PaperFocusEvidence,
} from './papers.js';
export { doiHref } from './doi.js';
