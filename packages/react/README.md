# `@astra-spec/ui`

Composable, themable React components for resolved
[ASTRA](https://astra-spec.org/) analyses.

`@astra-spec/ui` renders `ResolvedAnalysisDocument` and the `Resolved*` records
from [`@astra-spec/sdk`](https://github.com/LightconeResearch/astra-typescript).
It owns presentation: applications keep control of project loading, artifact
bytes and URLs, paper fetching, routing, and state.

| Layer | Responsibility |
| --- | --- |
| `@astra-spec/sdk` | Validate and resolve ASTRA projects; build canonical paths, provenance, artifact bindings, and indexes |
| `@astra-spec/ui` | Render primitives, record details, dialogs, inventory blocks, full views, and the theming contract |
| Your application | Provide a `ProjectReader`, load and refresh data, decode artifacts, fetch papers, and own navigation |

## Installation

```bash
npm install @astra-spec/ui @astra-spec/sdk react react-dom
```

The package is ESM-only and requires Node.js 20 or newer. Its peer dependency
ranges are `@astra-spec/sdk@^0.1.1` and React/React DOM 18 or 19.

## Quick start

Pass a document that has already been resolved by the SDK to `Inventory`, then
load the stylesheet for the view layer. The `astra-ui` class is required: it
scopes the package's styles and design tokens.

```tsx
import type { ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { Inventory } from '@astra-spec/ui/views';
import '@astra-spec/ui/styles.css';

export function AnalysisView({ document }: { document: ResolvedAnalysisDocument }) {
  return (
    <div className="astra-ui">
      <Inventory document={document} />
    </div>
  );
}
```

Resolving a project is deliberately outside the UI package. For example, a
Node.js host can resolve one with the SDK before rendering it:

```ts
import { resolveAnalysis } from '@astra-spec/sdk';
import { createNodeProjectReader } from '@astra-spec/sdk/node';

const reader = createNodeProjectReader('/path/to/astra-project');
const { document } = await resolveAnalysis(reader, { universeId: 'baseline' });
```

## Entry points

There is intentionally no root JavaScript entry point. Import the smallest
layer you need:

| Import | Use it for | Main exports |
| --- | --- | --- |
| `@astra-spec/ui/views` | Complete, ready-made surfaces | `Inventory` |
| `@astra-spec/ui/blocks` | Sections that can be assembled into a custom page | `AnalysisTree`, inventory lists, `InventorySection`, `InventoryOutline` |
| `@astra-spec/ui/components` | One ASTRA record or paper at a time | `*Detail`, `*Dialog`, `RecordDialog`, `RecordPreview`, `ArtifactPreview`, `useDetailStack` |
| `@astra-spec/ui/primitives` | Generic presentation with no resolved ASTRA model dependency beyond record kinds | Buttons, badges, dialogs, `PreviewPopover`, detail-layout compounds, lists, prose, labels |
| `@astra-spec/ui/model` | Pure, React-free derivations over SDK data | Record lookup, relationships, paper collection, display labels, DOI helpers |

Every public file also has a direct subpath, such as
`@astra-spec/ui/components/output-dialog` or
`@astra-spec/ui/primitives/button`. TypeScript declarations are included.

## Component guide

### Full view

`Inventory` is the highest-level component. It renders the selected analysis as
outputs, decisions, inputs, findings, and cited papers, with an optional outline
and a drill-down detail stack. Prior insights have no section of their own; they
open from the decisions and papers that cite them.

Its most useful options are:

- `analysisPath` selects a nested analysis (`$` is the project root).
- `sections` changes which inventory sections appear and their order.
- `showOutline` and `idPrefix` control outline navigation.
- `renderArtifact`, `renderText`, and `renderPaper` replace host-owned content.
- `paperMetadata` and `onFetchPaper` connect paper loading to host state.
- `detail`, `defaultDetail`, and `onDetailChange` control the detail stack.
- `detailMode="embedded"` renders details as an inline panel instead of a modal.
- `labels` overrides user-facing strings.
- `index` accepts an `AnalysisIndex` the host has already built.

### Inventory blocks

Use blocks when your application owns the page layout or routing:

| Component | Purpose |
| --- | --- |
| `AnalysisTree` | Recursive picker for the root analysis and its sub-analyses |
| `OutputsList`, `OutputCard` | Figure and table galleries plus a list of other outputs, with optional compact artifact previews |
| `DecisionsList` | Decision rows, selected options, and a controlled or uncontrolled tag filter |
| `InputsList` | Inputs with their source and declared type |
| `FindingsList` | Findings with claims and evidence counts |
| `PapersList`, `PaperRows` | Cited papers derived with `collectInventoryPapers` |
| `InventorySection`, `InventoryRecords`, `InventoryOutline` | Section chrome, kind-aware record layout, and anchor navigation for custom inventories |

List components emit records through callbacks such as `onOpenRecord`; they do
not own application navigation.

### Record and paper details

Each ASTRA record kind has both a dialog and a dialog-free detail body:

| Family | What it renders |
| --- | --- |
| `OutputDialog`, `OutputDetail`, `OutputPreview`, `OutputDialogActions` | Output metadata, artifact content, provenance, related inputs and decisions, and open/expand actions |
| `DecisionDialog`, `DecisionDetail` | Decision status, selected option, rationale, alternatives, tags, and supporting insights |
| `InputDialog`, `InputDetail` | Input type, source, and authored description |
| `FindingDialog`, `FindingDetail` | Finding claim, artifact-backed evidence, and literature evidence |
| `InsightDialog`, `InsightDetail`, `InsightTrigger`, `InsightEvidenceTitle` | Prior-insight claims, quoted sources, evidence labels, and decisions informed by the insight |
| `PaperDialog`, `PaperDetail`, `PaperDialogActions` | Paper metadata, cited passages, related insights and decisions, and DOI actions |

Use a `*Dialog` when you already have the record and any derived relationship
data. Use the corresponding `*Detail` inside a sidebar, route, or your own
dialog shell.

`RecordDialog` is the generic alternative. Given a `DetailEntry`, resolved
document, and SDK index, it selects the correct detail UI and derives the
record's relationships, evidence, insights, and papers. Pair it with
`useDetailStack` for drill-down and back navigation. The same stack can be
controlled by a router or left uncontrolled.

Dialogs support two modes:

- `mode="modal"` uses the native `<dialog>` element, including focus restoration
  and Escape/backdrop dismissal.
- `mode="embedded"` renders the same chrome as an inline panel.

### Record previews

`RecordPreview` is compact, positioning-agnostic content for three entry
shapes: a resolved record, an analysis node, or the contextual value emitted by
an inline ASTRA value. It preserves kind-specific evidence and provenance while
leaving artifact decoding, authored-text rendering, citation formatting, and
navigation with the host.

`PreviewPopover` is the matching generic primitive. It opens after a short
pointer-hover delay or immediately on keyboard focus, remains open while the
pointer or focus is inside it, flips and shifts at viewport edges, and dismisses
with Escape. Preview content may contain links, buttons, and nested previews,
so it is exposed as a non-modal dialog rather than a tooltip.

```tsx
import { indexAnalysis, type ResolvedDecision } from '@astra-spec/sdk';
import { RecordPreview } from '@astra-spec/ui/components';
import { PreviewPopover } from '@astra-spec/ui/primitives';
import '@astra-spec/ui/components.css';

const index = indexAnalysis(document);
const decision = index.recordByPath.get('decisions.method') as ResolvedDecision;
const analysis = index.analysisByRecordPath.get(decision.canonicalPath)!;

<PreviewPopover
  label={`Decision preview: ${decision.label}`}
  kind="decision"
  trigger={<button type="button">{decision.label}</button>}
  portalProps={{
    // Portaled content cannot inherit classes or attributes from the trigger.
    className: 'your-brand-scope',
    'data-astra-color-scheme': 'light',
  }}
>
  <RecordPreview
    entry={{ kind: 'record', record: decision, analysis }}
    document={document}
    index={index}
    renderArtifact={renderArtifact}
    renderText={renderText}
    renderCitation={(doi) => <Cite doi={doi} />}
    onOpenRecord={openFullRecord}
  />
</PreviewPopover>
```

The portal wrapper establishes an `astra-ui` scope when its mount does not
already inherit one. Use `portalProps` to add a brand scope and synchronize
`data-astra-color-scheme` plus any brand-specific scheme attribute. Alternatively,
mount it under an already-scoped element with `portalRoot`; with no `portalProps`,
the wrapper preserves that scope instead of creating a nested token root.
`renderRecordReference` receives each related record and its default trigger so
a host can wrap decision insights and finding outputs in a nested
`PreviewPopover` without copying preview markup.

### Artifact previews

The UI package does not read artifact files. `ArtifactPreview` renders safe,
host-provided preview data in six states: table, image, metric, text, loading,
or unavailable.

```tsx
import {
  ArtifactPreview,
  type ArtifactPreviewData,
  type ArtifactRenderer,
} from '@astra-spec/ui/components';

export function createArtifactRenderer(
  previews: ReadonlyMap<string, ArtifactPreviewData>,
): ArtifactRenderer {
  return (output, { compact }) => (
    <ArtifactPreview
      output={output}
      preview={previews.get(output.canonicalPath)}
      compact={compact}
    />
  );
}
```

`tablePreviewFromDelimited`, `tablePreviewFromRows`, and
`metricPreviewFromJson` turn already-loaded host data into preview values. They
perform no I/O.

### Primitives

The primitive layer is useful for building surfaces that match the library:

| Components | Purpose |
| --- | --- |
| `Button`, `IconButton`, `Badge` | Controls and status/kind labels |
| `PreviewPopover` | Accessible hover/focus positioning, viewport bounds, portal scoping, and nested preview coordination |
| `SurfaceHeader` | Reusable title, eyebrow, identifier, leading, and action layout |
| `Dialog`, `DialogProvider`, `DialogContent`, `DialogHeader`, `DialogBody`, `DialogClose`, `DialogBack`, `DialogAction` | Compound dialog context, state, and presentation building blocks |
| `DetailDialog` | Preset dialog shell used by record and paper dialogs |
| `DetailLayout`, `DetailMain`, `DetailRail`, `DetailSection`, `CountHeading` | Responsive detail-page structure |
| `RecordList`, `RecordIdentity`, `EmptyState` | Accessible, column-aligned record lists |
| `RelationList` | Counted related-record lists with optional navigation triggers |
| `Prose` | Authored text with built-in inline code and KaTeX math rendering |
| `LabelsProvider` | Scoped user-facing label overrides |

The layer also exports `Slot`, `cn`, prose parsers, label helpers, dialog hooks,
and their public types.

## Host extension points

- `renderArtifact(output, { compact })` renders host-decoded artifact content.
  Without it, outputs use `ArtifactPreview`'s unavailable state.
- `renderText(text, { field })` replaces the built-in prose renderer. The
  default understands inline code, `$inline$` math, and `$$display$$` math.
  Hosts that only need custom math commands can reuse that renderer with
  `renderProse(text, { macros })`; macro values are KaTeX expansion strings.
- `renderPaper(paper, { focusEvidence })` renders host-owned paper content.
- `onFetchPaper(doi)` asks the host to load paper data. Feed the result and
  `status: 'fetching' | 'error'` back through `paperMetadata`.
- `labels` on `Inventory`, or `LabelsProvider` around lower-level components,
  overrides the default UI copy.

The core components use render callbacks and events; they do not read project
files, resolve an ASTRA project, or fetch papers on the application's behalf.

`RecordDetails` provides the inventory's detail stack without any section or
page layout. It accepts the same document, index, renderers, metadata, and
controlled `detail` / `onDetailChange` props as `Inventory`. `AnalysisSelector`
in the blocks layer provides the analysis-tree dropdown for custom page headers.
The components layer also exports `parseInventoryOpenReference` and
`detailEntryForOpenReference` for translating external record links into detail
entries; integrations still validate their message origin or command boundary.

For continuous PDF reading, import the optional `PaperViewer` from
`@astra-spec/ui/components/paper-pdf-viewer` and use it in `renderPaper`:

```tsx
<PaperViewer paper={paper} options={options} loadPdfJs={loadPdfJs} />
```

Supply a stable `loadPdfJs(): Promise<PdfJs>` callback that initializes the
runtime and worker, and a usable `paper.pdfUrl`. The runtime fetches that URL;
the application owns authentication, paper caching/downloading, and PDF.js asset
delivery. The shared viewer owns continuous page layout, lazy rendering, zoom,
quote search, and highlighting. It does not bundle PDF.js. Runtime structural
types and quote helpers are available from `components/pdf-quote`.

## Styling and theming

Import exactly one bundle for the highest layer you render:

| Highest layer used | Stylesheet |
| --- | --- |
| Primitives | `@astra-spec/ui/primitives.css` |
| Components | `@astra-spec/ui/components.css` |
| Blocks | `@astra-spec/ui/blocks.css` |
| Views | `@astra-spec/ui/styles.css` or its alias `@astra-spec/ui/views.css` |

The bundles are nested: `components.css` includes primitives, `blocks.css`
includes components, and `styles.css` includes everything. Their import order
is part of the supported cascade.

Individual sheets are exported under `@astra-spec/ui/styles/*` for advanced
integrations, but they are not standalone bundles and are not one-to-one with
source components. Hosts normally should use one of the bundles above.

Components consume role-named `--astra-*` custom properties. Override them on
the same `.astra-ui` scope:

```css
.astra-ui {
  --astra-color-accent: #7a3e9d;
  --astra-font-heading: "Fraunces", serif;
  --astra-radius-control: 0.375rem;
}
```

The bundled light and dark values are independent, brand-neutral fallbacks so
the package remains usable on its own. An external theme should map its own
primitives onto these semantic roles under an explicit opt-in scope; it should
not duplicate component selectors or make `@astra-spec/ui` depend on the brand.

The complete token list and default values are in [TOKENS.md](./TOKENS.md).
Set `data-astra-color-scheme="light"` or `"dark"` on `.astra-ui`; `"dark"`
selects the built-in dark palette and `"light"` uses the base palette. Leaving
the attribute unset also uses the base palette. The package deliberately does
not inspect host-specific theme state. An integration maps its host theme to
this attribute and updates it when that theme changes.

Styled roots and internal parts expose `data-slot` attributes. Kinds and
variants use attributes including `data-kind`, `data-mode`, `data-layout`,
`data-density`, `data-variant`, `data-selected`, and `data-expanded`. Package
rules live in CSS cascade layers and use zero-specificity `.astra-ui` scoping,
so unlayered host CSS can override them predictably.

## Platform support

- React and React DOM 18 or 19
- Chrome and Edge 111+
- Firefox 113+
- Safari and iOS Safari 16.2+

## Development and examples

The [repository README](https://github.com/LightconeResearch/astra-ui#readme)
documents the Ladle playground, integration examples, screenshots, and project
development commands.

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
