# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@astra-spec/ui` — composable, themable React components that render a `ResolvedAnalysisDocument`
from `@astra-spec/sdk`. npm workspaces: `packages/react` (the published package) and
`packages/playground` (private Ladle workspace). Node >= 20.

## Commands

```bash
npm install              # playground links file:../../../lightcone-brand — the sibling must be checked out
npm run check            # the CI gate: lint + typecheck (+react19) + node tests + vitest
npm run build            # tsc only, packages/react/src -> dist (CSS is hand-written, never built)
npm test                 # build + node --test tests/*.test.mjs + vitest run
npm run typecheck        # build, then package + playground + tests/dom typecheck
npm run typecheck:react19 # same sources against @types/react@19 (package supports React 18 and 19)
npm run lint             # eslint . (typed rules on packages/react/src, plain rules elsewhere)
```

Two test runners, both importing the **built** `dist`, so build first when invoking them directly:

```bash
npm run build
node --test tests/model.test.mjs                                  # one node test file
node --test --test-name-pattern 'paper presentation' tests/model.test.mjs   # one test
npx vitest run tests/dom/dialog.test.tsx                          # one DOM test file (happy-dom)
npx vitest run tests/dom/dialog.test.tsx -t 'returns focus to the opener'  # one DOM test
npx eslint packages/react/src/primitives/button.tsx               # lint one file
```

`tests/*.test.mjs` are SSR/contract tests (`renderToStaticMarkup` over `tests/fixture.mjs`, a
hand-written minimal `ResolvedAnalysisDocument`). `tests/dom/*.test.tsx` are interaction tests.

Playground, screenshots, and the sibling consumers:

```bash
npm run playground                     # Ladle on http://localhost:61000, with the Lightcone brand
VITE_ASTRA_THEME=none npm run playground   # unthemed, package defaults only
npm run screenshots                    # build + Ladle + Playwright, every story light+dark @1280x900
npm run screenshots:compare            # ImageMagick diff vs packages/playground/screenshots/baseline
node packages/playground/scripts/screenshot.mjs <outDir> --filter <substring> --width 960
npm run check:consumers                # typecheck ../jupyterlab-astra and ../astra-theme against this dist
npm run fixture --workspace astra-ui-playground [projectRoot] [universeId]   # regenerate fixtures/desi.json
node scripts/tokens-doc.mjs            # regenerate packages/react/TOKENS.md from styles/tokens.css
```

Screenshots need `npx playwright install chromium` once and ImageMagick on the path. The baseline
directory is gitignored and exists only locally.

## Architecture

**Boundary.** The package is presentation only. The SDK owns validation, resolution, canonical
paths, provenance and `indexAnalysis`; the host owns file access, artifact bytes/URLs, paper
fetching, routing and application state. Nothing in `src/` may resolve an analysis, touch `node:`,
JupyterLab or MyST, or keep session/storage state — a contract test greps for all of it. Hosts call
the SDK's `indexAnalysis(document)` themselves; there is no local index wrapper.

**Layers.** No root entry; each entry is imported on its own, and every file is also a subpath
(`@astra-spec/ui/components/output-dialog`). Imports may only point downwards:

```
lib  <-  primitives  <-  model  <-  components  <-  blocks  <-  views
```

`model/` is pure derivation over the SDK and imports from no other layer (not even `lib`);
`components/` is one record or paper at a time (`OutputDialog`/`OutputDetail`, …, `RecordDialog`,
`useDetailStack`); `blocks/` are inventory page sections; `views/` holds `Inventory`, a ~100-line
composition of exported blocks and components — hosts that own navigation compose the same parts
directly, so keep everything `Inventory` uses exported.

**Navigation state.** `useDetailStack` is headless and works controlled (`value` + `onChange`) or
uncontrolled, like a React input; a `DetailEntry` is `{kind: 'record', canonicalPath, analysisPath}`
or `{kind: 'paper', doi, analysisPath, focusInsightPath?}` — paths, never object identity, so a
document refresh can prune entries that stopped resolving.

**Host extension points**, all optional props: `renderArtifact`, `renderText` (replaces the built-in
KaTeX/inline-code prose), `renderPaper`, `onFetchPaper` + `paperMetadata`, `onOpenArtifact`,
`labels` (every user-facing string, via `LabelsProvider`/`useLabels`).

**Component conventions.** `forwardRef`, spread the rest onto the root, `className` merged with
`cn()`. Write `data-slot="…"` *before* `{...props}` so a caller's slot wins, and `className` *after*
so `cn` merges. Variants are data attributes (`data-kind`, `data-mode`, `data-layout`,
`data-density`, `data-variant`, `data-selected`, `data-expanded`), never modifier classes.

**Styles.** `styles/<layer>/<file>.css` is named after the file that *emits* the classes, so the
mapping is not one-to-one with sources (see the README table). Rules live in
`@layer astra.tokens, astra.base, astra.components, astra.views` and are scoped `:where(.astra-ui)`,
so unlayered host CSS wins at any specificity. Components consume only role-named tokens
(`--astra-color-*`, `--astra-font-*`, `--astra-radius-*`, `--astra-space-*`) declared with light and
dark defaults in `styles/tokens.css`; a theme is a set of overrides on `.astra-ui`, and dark mode is
`data-astra-color-scheme="dark"`. The bundles nest
(`primitives.css` ⊂ `components.css` ⊂ `blocks.css` ⊂ `views.css` = `styles.css`) and **their import
order is part of the cascade**. Browser floor: Chrome 111, Safari 16.2, Firefox 113.

## Invariants the tests enforce

`tests/package-contract.test.mjs` fails loudly and specifically; read its assertion messages before
working around one. It checks that:

- layers never import upwards, and `src/` contains no resolver/session/host code; `katex` is
  imported exactly once, by `primitives/prose.tsx`, and is the package's only dependency;
- the exported names of every layer match `tests/exports.snapshot.json` — update that file
  deliberately in the same commit as an API change;
- `package.json` exports, `files` (which ships `src`), and the pinned peer ranges
  (`@astra-spec/sdk@^0.1.1`, `react >=18 <20`) — bump the manifest and the test together;
- every `astra-*` class a TSX file emits has a CSS rule, and every rule is emitted by some component
  (add the class and its rule together, and import a new sheet into the right bundle);
- every `var(--astra-*)` a sheet consumes has a default in `tokens.css`, nothing declared there is
  unused, and no component reaches for a raw palette name;
- every sheet starts with the `@layer` order declaration, wraps rules in a layer, and scopes with
  `:where(.astra-ui)` (a bare `.astra-ui .x` fails);
- `primitives.css`'s import list matches an exact expected order;
- a sheet using `@container` has a `container-type: inline-size` root declared in the sheet that
  owns it, and queried selectors are scoped under that container class (a block mounted outside
  `Inventory` must still collapse); the list of container-using sheets is asserted, so extend it
  deliberately.

## Releasing

`packages/react` (`@astra-spec/ui`) is the only published package; the root workspace is `private`
and carries no version. Releases are cut by tag — `.github/workflows/publish.yml` runs on `v*`:

```bash
git tag v0.0.2 && git push origin v0.0.2   # the tag is the single source of truth for the version
```

The workflow derives the version from the tag (`npm version --workspace @astra-spec/ui`), so **do
not hand-edit the version** in `packages/react/package.json` — CI writes it, then commits it and
`package-lock.json` back to `main`. `prepack` rebuilds `dist` and `prepublishOnly` runs
`npm run check`, so a red check aborts the publish before anything reaches npm.

Publishing authenticates with npm OIDC trusted publishing — there is no `NPM_TOKEN`. The trusted
publisher is registered on npmjs.com against this repository *and this workflow's filename*, so
renaming or moving `publish.yml` breaks releases until the publisher is updated. Node 24 is pinned
there (not CI's 22) because OIDC publishing needs npm >= 11.5.1.

## Working conventions

- **Parity first.** Surfaces are meant to render exactly as before; pre-existing visual bugs are
  preserved rather than fixed, except in a clearly separate commit. Verify CSS or markup changes
  with `npm run screenshots && npm run screenshots:compare`, and at `--width 960/640` too.
- CSS rules were converted 1:1 from an older markup; when changing a component's markup, grep its
  stylesheet for element-type and child-position selectors (`> img`, `> span + *`, grid track
  counts) that silently go dead or capture the wrong element.
- Modifier selectors must stay specificity-neutral: `.block:where([data-x])`, not `.block[data-x]`.
  `:is(a, b)` takes its most specific argument's specificity — keep such lists intact in one file.
- `packages/react/TOKENS.md` is generated; edit `styles/tokens.css` and rerun `scripts/tokens-doc.mjs`.
- The playground is the fastest way to see a change (`packages/playground/src/*.stories.tsx`, host
  wiring in `src/host.tsx`, real resolved analysis in `fixtures/desi.json`).
