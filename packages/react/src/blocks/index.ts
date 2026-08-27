/** Blocks: sections of the inventory page, composable into any layout. */
export { AnalysisTree } from './analysis-tree.js';
export type { AnalysisTreeProps } from './analysis-tree.js';
export { InventoryOutline, sectionKind, InventoryRecords, InventorySection } from './section.js';
export type {
  InventoryOutlineEntry,
  InventoryOutlineProps,
  InventoryRecordsProps,
  InventorySectionId,
  InventorySectionProps,
} from './section.js';
export { OutputCard, OutputsList } from './outputs-list.js';
export type { OutputCardProps, OutputsListProps } from './outputs-list.js';
export { ALL_TAGS, DecisionsList, decisionTagLabel } from './decisions-list.js';
export type { DecisionsListProps } from './decisions-list.js';
export { InputsList } from './inputs-list.js';
export type { InputsListProps } from './inputs-list.js';
export { FindingsList } from './findings-list.js';
export type { FindingsListProps } from './findings-list.js';
export { PriorInsightsList } from './prior-insights-list.js';
export type { PriorInsightsListProps } from './prior-insights-list.js';
export { PaperRows, PapersList } from './papers-list.js';
export type { PaperRowsProps, PapersListProps } from './papers-list.js';
