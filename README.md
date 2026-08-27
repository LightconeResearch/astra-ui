# `@lightcone-research/astra-ui`

Composable, themable React components for resolved [ASTRA](https://astra-spec.org/) analyses.

The package renders `ResolvedAnalysisDocument` and the `Resolved*` records from
[`@astra-spec/sdk`](https://github.com/LightconeResearch/astra-typescript). It
follows a shadcn/ui-style boundary — data flows in, events flow out, hosts
compose the pieces they need — but ships as an ordinary npm library rather than
vendored source. It does not parse ASTRA files, resolve references, read
artifacts, fetch papers, or hold application state.

| Layer | Owns |
| --- | --- |
| `@astra-spec/sdk` | Validation, resolution, canonical paths, provenance, artifact bindings, indexes |
| `@lightcone-research/astra-ui` | Primitives, record details and dialogs, inventory views, the token contract |
| Host | `ProjectReader`, loading and refresh, artifact bytes and URLs, paper fetching, routing |

## Install

```bash
npm install @lightcone-research/astra-ui @astra-spec/sdk react react-dom
```

Peers: `@astra-spec/sdk@^0.1.1`, React 18 or 19.

## Entry points

The package has no root entry; import the layer you need. Each layer only
depends on the ones below it, and every file is also importable on its own.

| Entry | What you import from it | Stylesheet |
| --- | --- | --- |
| `./primitives` | Generic UI with no ASTRA knowledge: `Button`, `Badge`, `SurfaceHeader`, the `Dialog` compound, `RecordList`, `RelationList`, `DetailLayout`, `Prose`, `cn`, `Slot`, labels | `primitives.css` |
| `./components` | One thing at a time: `OutputDialog` / `OutputDetail`, `DecisionDialog` / `DecisionDetail`, … for every record kind and for papers; `ArtifactPreview`; `InsightTrigger`; `RecordDialog` (any record); `useDetailStack` | `components.css` |
| `./blocks` | Sections of the inventory page: `OutputsList`, `DecisionsList`, `InputsList`, `FindingsList`, `PriorInsightsList`, `PapersList`, `InventorySection`, `InventoryOutline`, `AnalysisTree` | `blocks.css` |
| `./views` | Ready-made full surfaces: `Inventory` | `views.css` |
| `./model` | Pure derivations over the SDK model, for hosts composing their own views (over the SDK's `indexAnalysis`): `locateRecord`, `outputRelations`, `findingEvidence`, `decisionInsights`, `informedDecisions`, `collectInventoryPapers`, `doiHref` | — |
| `./<layer>/<file>` | Individual files, e.g. `@lightcone-research/astra-ui/components/output-dialog` | `styles/<layer>/<file>.css` |

`styles.css` is an alias of `views.css`; the bundles nest
(`primitives.css` ⊂ `components.css` ⊂ `blocks.css` ⊂ `views.css`), so import
exactly one, or the per-component sheets you need on top of
`styles/tokens.css` and `styles/base.css`.

**Vocabulary.** A *record* is anything an ASTRA analysis declares — an input,
output, decision, finding or prior insight (the SDK's `ResolvedRecord`);
`RecordDialog`, `RecordList` and `onOpenRecord` are generic over those kinds.
The *inventory* is the page that lists every record of an analysis.

## Resolve once, then render

```tsx
import { resolveAnalysis } from '@astra-spec/sdk';
import { createNodeProjectReader } from '@astra-spec/sdk/node';
import { ArtifactPreview, type ArtifactRenderer } from '@lightcone-research/astra-ui/components';
import { Inventory } from '@lightcone-research/astra-ui/views';
import '@lightcone-research/astra-ui/styles.css';

const bundle = await resolveAnalysis(createNodeProjectReader(projectRoot), { universeId: 'baseline' });
const bindings = new Map(bundle.bindings.map((binding) => [binding.outputPath, binding]));

const renderArtifact: ArtifactRenderer = (output, { compact }) => {
  const binding = bindings.get(output.canonicalPath);
  return binding
    ? <HostArtifactPreview output={output} path={binding.path} cacheToken={binding.cacheToken} compact={compact} />
    : <ArtifactPreview output={output} compact={compact} />;
};

export function AnalysisView() {
  return (
    <div className="astra-ui">
      <Inventory
        document={bundle.document}
        renderArtifact={renderArtifact}
        onOpenArtifact={(output) => openArtifact(bindings.get(output.canonicalPath))}
      />
    </div>
  );
}
```

Wrap the tree in an element with the `astra-ui` class: that is the token and
style scope.

### Host extension points

- `renderArtifact(output, { compact })` renders host-decoded artifact content.
  `ArtifactPreview` renders host-safe `ArtifactPreviewData` (table, image,
  metric, text, loading, unavailable); `tablePreviewFromDelimited`,
  `tablePreviewFromRows` and `metricPreviewFromJson` build that data without
  doing any I/O.
- `renderText(text, { field })` replaces the built-in prose rendering, which
  typesets inline `code`, `$inline$` and `$$display$$` math with KaTeX
  (`primitives.css` imports `katex/dist/katex.css`; bundlers resolve it from
  the package's `katex` dependency).
- `renderPaper(paper, { focusEvidence })` renders host-owned paper content.
- `onFetchPaper(doi)` is an event; the host returns metadata (and
  `status: 'fetching' | 'error'`) through `paperMetadata`.
- `labels` overrides every user-facing string.

### Compose your own surface

`Inventory` is a ~100-line composition of exported blocks and components. A
host that owns navigation (a router, a JupyterLab command, a MyST link) uses
the same parts directly:

```tsx
import { RecordDialog, useDetailStack } from '@lightcone-research/astra-ui/components';
import { OutputsList } from '@lightcone-research/astra-ui/blocks';
import { indexAnalysis } from '@astra-spec/sdk';

function OutputsPage({ document, detail, onDetailChange }) {
  const index = useMemo(() => indexAnalysis(document), [document]);
  const stack = useDetailStack({ value: detail, onChange: onDetailChange });
  return (
    <>
      <OutputsList analysis={document.analysis} onOpenRecord={stack.openRecord} />
      {stack.active ? (
        <RecordDialog
          entry={stack.active}
          document={document}
          index={index}
          onOpenRecord={stack.pushRecord}
          onBack={stack.previous ? stack.back : undefined}
          onClose={stack.close}
        />
      ) : null}
    </>
  );
}
```

`Inventory` itself accepts `detail` / `onDetailChange` (controlled
stack), `sections`, `idPrefix`, `showOutline`, `detailMode="embedded"`, and an
`index` you already built.

Dialogs are a compound (`Dialog`, `DialogContent`, `DialogHeader`,
`DialogBody`, `DialogClose`, `DialogBack`, `DialogAction`) on the native
`<dialog>` element; `DetailDialog` is the record-detail preset, and every kind
exposes a dialog-free `*Detail` body for sidebars and embedded pages.

## Theming

Components consume only role-named tokens (`--astra-color-*`,
`--astra-font-*`, `--astra-radius-*`, `--astra-space-*`), all declared with
light and dark defaults in `styles/tokens.css` at zero specificity. A theme is
a set of overrides on `.astra-ui`:

```css
.astra-ui {
  --astra-color-accent: #7a3e9d;
  --astra-font-heading: "Fraunces", serif;
  --astra-radius-control: 0.375rem;
}
```

The full list is in [`packages/react/TOKENS.md`](packages/react/TOKENS.md).
Dark mode: set `data-astra-color-scheme="dark"` on `.astra-ui`, or let the
JupyterLab / VS Code host signal it. The package knows nothing about any
particular theme: `tokens.css` holds literal defaults only, and a theme maps
its own palette and fonts onto the role names. `@lightcone-research/lightcone-brand`
is one such theme; the package renders sensibly without it.

Styling hooks for hosts:

- Every component accepts `className`, forwards its ref, and spreads extra
  attributes onto its root.
- Every part carries a `data-slot` attribute (`data-slot="surface-header-title"`), and
  variants are data attributes (`data-kind`, `data-mode`, `data-layout`,
  `data-density`, `data-variant`, `data-selected`, `data-expanded`).
- All rules live in `@layer astra.tokens, astra.base, astra.components,
  astra.views` (the cascade layers are coarser than the folders: primitives and
  components share `astra.components`, blocks and views share `astra.views`)
  and are scoped with `:where(.astra-ui)`, so unlayered host CSS overrides any
  component rule at any specificity. Standalone variant
  selectors (`.astra-dialog:where([data-mode="embedded"])`) add no
  specificity, like the modifier classes they replace.
- `[data-kind="decision"]` on any element sets `--astra-kind`,
  `--astra-kind-ink` and `--astra-kind-soft` for that subtree.

Browser floor: Chrome 111, Safari 16.2, Firefox 113 (`color-mix`,
`@container`, `@layer`).

## Playground

`packages/playground` is a [Ladle](https://ladle.dev) workspace that renders
every layer of the package over a real analysis — the resolved
`desi-myst-proto` project, committed as `fixtures/desi.json`. It is the
fastest way to see what a component looks like, to try a change while
developing, and it is the source of the parity screenshots.

```bash
npm run playground       # http://localhost:61000
```

Stories, one file per layer of interest (`packages/playground/src/*.stories.tsx`):

| Group | Stories | Shows |
| --- | --- | --- |
| Explorer | Root, Clustering, Reconstruction, EmbeddedDetail, Tree | the `Inventory` view on the root and on child analyses, with the detail dialog inline, and the `AnalysisTree` block |
| Dialogs / Modal | OutputFigure, OutputTable, OutputData, Decision, Finding, Input, Insight, Paper, PaperWithoutContent, WithBackTrail | every record and paper dialog as a modal `<dialog>`, including the back-trail state |
| Dialogs / Embedded | the same ten | the same dialogs in `mode="embedded"` (a panel inside the page, as a JupyterLab host renders them) |
| Primitives | Buttons, Badges, Headers, Artifacts, RecordLists, Relations | the `./primitives` layer and `ArtifactPreview`, every variant side by side |
| Theme | Colors, Typography | the token contract: each `--astra-*` token with its resolved value |

The Ladle toolbar toggles light/dark (`data-astra-color-scheme`) and the
viewport width. The host side of the stories — artifact URLs, paper metadata,
`renderArtifact` / `renderPaper` — lives in `src/host.tsx`, so it doubles as
a minimal example of what an integration provides.

The playground applies `@lightcone-research/lightcone-brand` on top of
`styles.css` (linked from `../lightcone-brand`), so it shows the Lightcone
look rather than the package defaults; remove the import in
`.ladle/components.tsx` to see the unthemed rendering.

Regenerate the fixture from any ASTRA project with
`npm run fixture --workspace astra-ui-playground [projectRoot] [universeId]`;
it writes `fixtures/desi.json` and copies the previewable artifacts (png,
csv, ...) into `packages/playground/public`, which is gitignored.

### Screenshots and parity

```bash
npm run screenshots      # every story, light and dark, 1280×900, into screenshots/current
npm run screenshots:compare
```

`screenshots` builds the package, starts Ladle, and captures each story
with Playwright; `screenshots:compare` diffs the run against
`packages/playground/screenshots/baseline` with ImageMagick's `compare` and
fails on any pixel difference. The baseline is the pre-refactor rendering of
`main`, which is how "renders exactly as before" is verified. Needs
`npx playwright install chromium` once and ImageMagick on the path.

## Development

```bash
npm install
npm run typecheck        # package, playground, and React 19 typings
npm run lint
npm test                 # build, SSR + contract tests, DOM tests
npm run check            # all of the above
npm run check:consumers  # type-check ../jupyterlab-astra and ../astra-theme
```

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
