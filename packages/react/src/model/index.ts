/** Model: pure, React-free derivations over the SDK's resolved analysis. */
export { analysisTitle, countLabel, decisionTagLabel, inputSourceLabel, isInsight, isVisualOutput, recordTitle, selectedOptionLabel } from './records.js';
export { sectionKind, surfaceGlyph } from './kind.js';
export type { InventorySectionId, SurfaceKind } from './kind.js';
export { locateRecord } from './locate-record.js';
export type { LocatedRecord } from './locate-record.js';
export {
  decisionInsightPaths,
  decisionInsights,
  findingEvidence,
  findingLiterature,
  groupFindingEvidence,
  informedDecisions,
  linkedRecord,
  outputDecisionPaths,
  outputRelations,
} from './relations.js';
export type { FindingEvidenceGroup, FindingEvidenceLink, LinkedRecord, OutputRelations } from './relations.js';
export {
  analysesForPaperView,
  collectInventoryPapers,
  findPaper,
  insightDois,
  paperEvidence,
  paperForDoi,
  paperMetadataFor,
  primaryLiteratureEvidence,
} from './papers.js';
export type {
  InventoryPaper,
  InventoryPaperMetadata,
  InventoryPaperMetadataMap,
  PaperFetchStatus,
} from './papers.js';
export { doiHref } from './doi.js';
