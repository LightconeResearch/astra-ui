# `@lightcone-research/astra-ui`

Composable, themable React components for `ResolvedAnalysisDocument` from
`@astra-spec/sdk`.

```tsx
import { InventoryExplorer } from '@lightcone-research/astra-ui/views';
import '@lightcone-research/astra-ui/styles.css';

<div className="astra-ui">
  <InventoryExplorer document={bundle.document} renderArtifact={renderArtifact} />
</div>
```

Entry points: `./ui` (primitives), `./data` (pure derivations), `./records`
(record details and dialogs), `./components` (all three), `./views` (inventory
views and the composed explorer), plus every file individually
(`./records/output-dialog`, `./ui/button`, ...). Stylesheets: `ui.css`,
`components.css`, `views.css` (= `styles.css`), or one sheet per component
under `styles/`.

The package owns presentation only. The host resolves ASTRA with the SDK and
owns files, artifact bytes and URLs, cache invalidation, paper fetching, and
navigation; `renderArtifact`, `renderPaper`, `renderText`, and `onFetchPaper`
are the extension points.

Theming is a set of `--astra-*` overrides on `.astra-ui`; every token and its
defaults are listed in [TOKENS.md](./TOKENS.md). See the
[repository README](https://github.com/LightconeResearch/astra-ui#readme) for
the full integration guide and [CHANGELOG.md](./CHANGELOG.md) for migration
notes.
