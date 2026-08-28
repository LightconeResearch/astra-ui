# `@astra-spec/ui`

[![CI](https://github.com/LightconeResearch/astra-ui/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LightconeResearch/astra-ui/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40astra-spec%2Fui?logo=npm&label=npm)](https://www.npmjs.com/package/@astra-spec/ui)

Composable, themable React components for resolved
[ASTRA](https://astra-spec.org/) analyses.

`@astra-spec/ui` turns the resolved data model from
[`@astra-spec/sdk`](https://github.com/LightconeResearch/astra-typescript) into
accessible inventory views, record details, dialogs, artifact previews, and
lower-level building blocks. The library stays presentation-only: applications
retain control of loading, files, network requests, routing, and state.

> [!IMPORTANT]
> **Project status: early alpha.** The library is ready for evaluation and early
> integrations, but its public APIs and styling contract may still change before
> 1.0.

**[Read the complete package and component guide →](packages/react/README.md)**

[Token reference](packages/react/TOKENS.md) ·
[ASTRA specification](https://astra-spec.org/) ·
[TypeScript SDK](https://github.com/LightconeResearch/astra-typescript)

## Highlights

- **Composable by design.** Use the complete `Inventory` view, individual
  inventory blocks, record dialogs and detail bodies, or generic primitives.
- **Host-controlled integration.** Render callbacks and events connect artifact
  decoding, paper content, navigation, and application state without hiding I/O
  inside the component library.
- **Neutral and themeable without lock-in.** Role-based `--astra-*` tokens,
  standalone light and dark defaults, cascade layers, and stable `data-*` hooks
  let hosts apply a separate brand without coupling it to the components.
- **Typed and tested.** ESM subpath exports include TypeScript declarations and
  are checked with React 18 and React 19 typings, SSR tests, DOM interaction
  tests, and package contract tests.

## Quick start

```bash
npm install @astra-spec/ui @astra-spec/sdk react react-dom
```

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

The document must already be resolved by `@astra-spec/sdk`. See the
[package guide](packages/react/README.md) for resolution examples, every public
component, host extension points, stylesheet choices, theming, and platform
support.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `@astra-spec/sdk` | Validation, resolution, canonical paths, provenance, artifact bindings, and indexes |
| `@astra-spec/ui` | Primitives, record and paper details, dialogs, inventory blocks and views, and the token contract |
| Host application | Project reading, loading and refresh, artifact bytes and URLs, paper fetching, routing, and state |

The public API is layered and has no root JavaScript export:

```text
primitives + model → components → blocks → views
```

Import the layer you need, for example `@astra-spec/ui/components` or
`@astra-spec/ui/views`. Individual files are also available as subpaths.

## Repository

| Path | Purpose |
| --- | --- |
| [`packages/react`](packages/react) | Published `@astra-spec/ui` package, source, styles, and package documentation |
| [`packages/playground`](packages/playground) | Private Ladle workspace covering views, dialogs, primitives, responsive layouts, and themes |
| [`tests`](tests) | SSR, package-contract, model, attribute-forwarding, and DOM interaction tests |
| [`scripts`](scripts) | Consumer checks, token documentation, and project utilities |

## Development

Requires Node.js 20 or newer. The branded playground also expects the
`lightcone-brand` repository to be checked out at `../lightcone-brand` before
installing dependencies.

```bash
npm install
npm run playground
```

The playground opens at <http://localhost:61000> and exercises the package over
a committed resolved ASTRA project. Run
`VITE_ASTRA_THEME=none npm run playground` to display only the package defaults.

| Command | Purpose |
| --- | --- |
| `npm run check` | Run the complete CI gate: lint, builds, type checks, React 19 checks, SSR/contract tests, and DOM tests |
| `npm run build` | Build the React package into `packages/react/dist` |
| `npm test` | Build and run the Node and Vitest suites |
| `npm run playground` | Start the Ladle component explorer |
| `npm run screenshots` | Capture every story in light and dark mode with Playwright |
| `npm run screenshots:compare` | Compare a capture against the local ImageMagick baseline |
| `npm run check:consumers` | Type-check sibling consumers against the local package build |

Screenshot capture requires Playwright Chromium; comparison additionally
requires ImageMagick.

## Releases

The root workspace is private; only `packages/react` is published. A `v*` Git
tag triggers the [publish workflow](.github/workflows/publish.yml), which derives
the package version from the tag, runs the release checks, and publishes through
npm trusted publishing. Package versions are not edited by hand.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
