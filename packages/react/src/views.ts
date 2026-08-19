/**
 * The application views layer: the complete inventory explorer. Imported by
 * application hosts; publication themes should use the `components` entry
 * instead. Pair with the `views.css` entry.
 */
export {
  InventoryExplorer,
} from './full-inventory/InventoryOutline.js';
export type { InventoryOutlineProps } from './full-inventory/InventoryOutline.js';
export { OverviewInventory } from './full-inventory/OverviewInventory.js';
export type { OverviewInventoryProps } from './full-inventory/OverviewInventory.js';
export {
  DecisionsInventory,
} from './full-inventory/DecisionsInventory.js';
export {
  FindingsInventory,
} from './full-inventory/FindingsInventory.js';
export {
  InputsInventory,
} from './full-inventory/InputsInventory.js';
export {
  OutputsInventory,
} from './full-inventory/OutputsInventory.js';
export {
  PapersInventory,
} from './full-inventory/PapersInventory.js';
export { PriorInsightsInventory } from './full-inventory/PriorInsightsInventory.js';
export {
  deriveProjectGraph,
  graphRecordNodeId,
  graphScopeNodeId,
} from './graph/model.js';
export type {
  DeriveProjectGraphOptions,
  GraphDerivation,
  GraphEdge,
  GraphNode,
  GraphRecordNode,
  GraphScopeNode,
} from './graph/model.js';
export {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  layoutProjectGraph,
} from './graph/layout.js';
export type { GraphLayout, GraphNodePosition } from './graph/layout.js';
