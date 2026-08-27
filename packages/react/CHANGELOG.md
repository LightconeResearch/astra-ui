# Changelog

## 0.3.0

Rebuilt as a layered, themable component library. Rendering is unchanged:
every surface is pixel-identical to 0.2.0 (verified with 62 light/dark
screenshots of the playground stories), but the API, the class names, and
the token contract are new.

### Package layout

- No root entry. Import `./primitives`, `./components`, `./blocks`,
  `./views`, `./model`, or any single file (`./components/output-dialog`,
  `./primitives/dialog`, ...).
- Stylesheets: `primitives.css` ⊂ `components.css` ⊂ `blocks.css` ⊂
  `views.css` = `styles.css`, or per-component sheets under `styles/`.
  `ui.css` and `inventory.css` are gone.
- `src` ships with the package; declaration maps resolve to it.
- Peer `@astra-spec/sdk` is `^0.1.1`: the resolved data model is unchanged
  from 0.0.8, and record lookups use the SDK's `indexAnalysis` (including its
  `analysisByRecordPath`) instead of a package-local index. Node 20 or
  later, matching the SDK.

### Migration from 0.2.0

| 0.2.0 | 0.3.0 |
| --- | --- |
| `import … from '@lightcone-research/astra-ui'` | import a layer: `/primitives`, `/components`, `/blocks`, `/views`, `/model` |
| `/components` (primitives + dialogs), `/views` (lists + explorer) | primitives → `/primitives`; dialogs → `/components`; lists, sections, tree → `/blocks`; the page → `/views`; derivations → `/model` |
| `InventoryDetailDialog`, `InventoryDetailSurface`, `InventoryDetailPresentation` | `DetailDialog` (preset) or the `Dialog` compound; `DialogProvider` for mode/back text |
| `eyebrow="Decision · Analysis"` | `kindLabel="Decision"` (no more string parsing) |
| `analysis` prop on every dialog | dropped; dialogs take the record and its derived data only |
| `OutputDialog { output }`, `InsightDetailDialog { insight }`, `PaperDialog { paper }` | every dialog and detail takes `record` |
| `InsightDetailDialog`, `InsightDetailTrigger` | `InsightDialog`, `InsightTrigger` |
| `onOpenDependency`, `onOpenEvidence` | `onOpenRecord(record, analysis)` |
| `onOpenOutput`, `onOpenDecision`, … on inventories | `onOpenRecord` |
| `InventoryRecordList { ariaLabel }`, `InventoryRecordIdentity`, `InventoryEmptyState` | `RecordList { label }`, `RecordIdentity`, `EmptyState` |
| `InventoryRelationList` (className replaced the default) | `RelationList` (className merges; pass `astra-detail__relations` yourself) |
| `InventoryDetailLayout { className: '…--single' }`, `InventoryDetailMain`, `InventoryDetailRail`, `InventoryDetailProse`, `InventoryCountHeading` | `DetailLayout { layout: 'single' }`, `DetailMain`, `DetailRail`, `DetailSection { heading: 'section' }`, `CountHeading` |
| `InventoryProse`, `TextRenderer = (text) => …` | `Prose`, `TextRenderer = (text, { field }) => …` |
| `OverviewInventory` | `AnalysisTree` (in `/blocks`) |
| `OutputsInventory`, `DecisionsInventory`, `InputsInventory`, `FindingsInventory`, `PriorInsightsInventory`, `PapersInventory` | `OutputsList`, `DecisionsList`, `InputsList`, `FindingsList`, `PriorInsightsList`, `PapersList` |
| `InventoryExplorer` | `Inventory` |
| `collectInventoryPapers(document, index, …)` | unchanged; `index` is the SDK's `AnalysisIndex` (`indexAnalysis(document)`) |
| private `InventoryRecordDetail`, relation/evidence derivations | `RecordDialog`, `outputRelations`, `findingEvidence`, `decisionInsights`, `informedDecisions`, `locateRecord` |
| local dialog stack in `InventoryExplorer` | `useDetailStack`; `Inventory { detail, defaultDetail, onDetailChange }` |
| `inventory-*` class names | `astra-*` blocks with `data-*` variants; see the styling contract in the README |
| `--astra-ink`, `--astra-rule`, `--astra-label`, … (brand raw names) | `--astra-color-text`, `--astra-color-border`, `--astra-font-ui`, … (see TOKENS.md) |
| tokens supplied only by `@lightcone-research/lightcone-brand` | every token has a default in `styles/tokens.css`; the brand is an optional override |

### Added

- `Dialog` compound with a native `<dialog>`, `DialogClose`,
  `useDialogDismissGuard`, and a dismissal guard so a nested full-screen
  artifact no longer closes the whole dialog on Escape. Dismissal runs the
  native `close()`, and focus returns to the element that opened the dialog.
- `RecordDialog` keeps one dialog element mounted across drill-downs and
  renders `fallback` inside the shell when an entry stops resolving;
  `Inventory` prunes such entries from the stack.
- Controlled state everywhere it existed locally: detail stack, decision tag
  filter, output full-screen.
- `Inventory { sections, idPrefix, showOutline, labels, index }`,
  `InventorySection`, `InventoryOutline`, `InventoryRecords`.
- `ArtifactPreviewData` gains `{ kind: 'loading' }`; `InventoryPaperMetadata`
  gains `status` / `error`.
- Pure preview builders: `tablePreviewFromDelimited`, `tablePreviewFromRows`,
  `metricPreviewFromJson`.
- `Button { asChild }`, `Slot`, `cn`, `LabelsProvider` / `useLabels`.
- Every component: `className` merge, ref forwarding, rest-prop spread,
  `data-slot`.
- Print and reduced-motion rules.

### Removed

- The generation-layered stylesheets and every dead selector; the duplicated
  kind-colour map (now one `[data-kind]` rule).
- `@lightcone-research/lightcone-brand` no longer needs to ship a reset or
  focus ring; `styles/base.css` owns root paint, box model, focus, motion and
  print.

## 0.2.0

Consumed resolved analyses directly; removed the `./core` entry and the
view-model, session, and PDF runtime layers.
