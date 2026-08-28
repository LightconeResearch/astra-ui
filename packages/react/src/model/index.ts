/** Model: pure, React-free derivations over the SDK's resolved analysis. */
export { analysisTitle, countLabel, isInsight, isVisualOutput, recordTitle, selectedOptionLabel } from './records.js';
export { locateRecord } from './locate-record.js';
export type { LocatedRecord } from './locate-record.js';
export {
  decisionInsightPaths,
  decisionInsights,
  findingEvidence,
  findingLiterature,
  indirectDecisionPaths,
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
  paperForDoi,
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
