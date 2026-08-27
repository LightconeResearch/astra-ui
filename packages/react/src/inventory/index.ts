/** Inventory views: per-kind lists, the analysis tree, and the composed explorer. */
export { AnalysisTree } from './analysis-tree.js';
export type { AnalysisTreeProps } from './analysis-tree.js';
export { InventoryOutline, InventoryRecords, InventorySection } from './section.js';
export type {
  InventoryOutlineEntry,
  InventoryOutlineProps,
  InventoryRecordsProps,
  InventorySectionId,
  InventorySectionProps,
} from './section.js';
export { OutputCard, OutputsInventory } from './outputs-inventory.js';
export type { OutputCardProps, OutputsInventoryProps } from './outputs-inventory.js';
export { ALL_TAGS, DecisionsInventory, decisionTagLabel } from './decisions-inventory.js';
export type { DecisionsInventoryProps } from './decisions-inventory.js';
export { InputsInventory } from './inputs-inventory.js';
export type { InputsInventoryProps } from './inputs-inventory.js';
export { FindingsInventory } from './findings-inventory.js';
export type { FindingsInventoryProps } from './findings-inventory.js';
export { PriorInsightsInventory } from './prior-insights-inventory.js';
export type { PriorInsightsInventoryProps } from './prior-insights-inventory.js';
export { PaperList, PapersInventory } from './papers-inventory.js';
export type { PaperListProps, PapersInventoryProps } from './papers-inventory.js';
export { DEFAULT_SECTIONS, InventoryExplorer } from './explorer.js';
export type { InventoryExplorerProps } from './explorer.js';
