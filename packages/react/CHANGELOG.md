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
| `onFetchPaper: (doi) => Promise<InventoryPaperMetadata>` | `onFetchPaper: (doi) => void`; the host owns the request and reports progress through `paperMetadata[doi].status` / `.error` |
| `paperMetadataFromCitations`, `citationTitleFromHtml` | removed; fetching and parsing paper metadata is a host concern (`onFetchPaper` + `paperMetadata`) |
| `normalizeDoi` re-exported from the package | import it from `@astra-spec/sdk`; `doiHref` stays in `./model` |
| `--astra-ink`, `--astra-rule`, `--astra-label`, … (brand raw names) | `--astra-color-text`, `--astra-color-border`, `--astra-font-ui`, … (see TOKENS.md) |
| tokens supplied only by `@lightcone-research/lightcone-brand` | every token has a literal default in `styles/tokens.css` and the package references no brand names; a theme maps its palette onto the role tokens |

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

### Fixed after review

- Escape inside a modal is decided when the `<dialog>` `cancel` event
  arrives: a full-screen artifact exits and the dialog stays open; only the
  next Escape closes it. Backdrop dismissal is primary-button only. The
  full-screen layer is a `role="dialog"`.
- A close the component runs itself (host `open={false}`, unmount, React
  StrictMode's simulated unmount) no longer reports a dismissal, so dialogs
  no longer close on open in development.
- Focus moves to the close control only when a body swap removed the focused
  element, never on unrelated re-renders.
- `DetailDialog` and every kind `*Dialog` forward `id`, `style`, `data-*`,
  `aria-*` and handlers to the dialog root.
- `Inventory`: switching analysis makes exactly one stack change; the
  persistent dialog stays mounted while an entry or its analysis stops
  resolving; an unknown `analysisPath` shows the root (documented).
- One evidence rule (first entry with a DOI) decides both the passage an
  insight shows and the paper it opens.
- A caller's `data-slot` wins over the primitive default it builds on
  (`dialog-close`, `dialog-header`, `decision-detail`, ... reach the DOM).
- `Slot` / `asChild` forwards the child's own ref in React 18 development
  builds too.
- `AnalysisTree` honours a host `aria-label`; `InsightTrigger` runs a host
  `onKeyDown` first and respects `preventDefault`.
- `outputRelations` lists a record referenced twice only once; a finding's
  literature evidence (DOI, quote) renders as source papers; an alias input
  shows what it resolves from and its own source; delimited previews parse
  quoted delimiters, quotes and line breaks.
- Layout: the outline's section glyph column is back (`InventoryOutlineEntry.kind`,
  `sectionKind()`), so labels and counts no longer overlap; the output
  dialog's "Open artifact" / "Full screen" controls are `DialogAction`s and
  no longer collide with the close button; the output description flows in
  the rail instead of clipping under "Recipe".
- Layout audit (CSS written for main's markup vs. what the components render):
  image artifacts fill the preview box instead of being centred and clipped
  (legend and caption were cut) and gallery thumbnails fit again; in-dialog
  tables and text artifacts use colours that contrast with their background
  in dark mode; figure captions use the artifact ink; the "Recipe" block no
  longer clips its last line; description and recipe are spaced in the
  single-column output dialog; static and interactive relation rows share
  one column template; `AnalysisTree` ships its own styles; header actions
  render an icon + label so the narrow-viewport rule collapses them to the
  icon; the full-screen header has its eyebrow and × glyph back; section
  headings count with their noun again ("65 outputs", `labels.sectionCount`,
  `InventorySection { countLabel }`); input rows keep the two-column layout
  down to 34rem containers.
- Authored prose renders inline `code`, `$inline$` and `$$display$$` math
  with KaTeX by default again (as 0.2.0 did): `katex` is the package's one
  dependency, `primitives.css` imports `katex/dist/katex.css`, and
  `parseProse` / `renderProse` are exported. `renderText` still replaces it.

### Removed

- The generation-layered stylesheets and every dead selector; the duplicated
  kind-colour map (now one `[data-kind]` rule).
- `@lightcone-research/lightcone-brand` no longer needs to ship a reset or
  focus ring; `styles/base.css` owns root paint, box model, focus, motion and
  print.

## 0.2.0

Consumed resolved analyses directly; removed the `./core` entry and the
view-model, session, and PDF runtime layers.
