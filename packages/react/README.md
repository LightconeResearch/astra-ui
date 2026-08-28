# `@lightcone-research/astra-ui`

Composable, themable React components for `ResolvedAnalysisDocument` from
`@astra-spec/sdk`.

```tsx
import { Inventory } from '@lightcone-research/astra-ui/views';
import '@lightcone-research/astra-ui/styles.css';

<div className="astra-ui">
  <Inventory document={bundle.document} renderArtifact={renderArtifact} />
</div>
```

Entry points: `./primitives` (generic UI), `./components` (one record or
paper at a time: dialogs and detail bodies), `./blocks` (sections of the
inventory page), `./views` (full surfaces), `./model` (pure derivations), plus
every file individually (`./components/output-dialog`, `./primitives/button`,
...). Stylesheets: `primitives.css` ⊂ `components.css` ⊂ `blocks.css` ⊂
`views.css` (= `styles.css`), or one sheet per component under `styles/`.

The package owns presentation only. The host resolves ASTRA with the SDK and
owns files, artifact bytes and URLs, cache invalidation, paper fetching, and
navigation; `renderArtifact`, `renderPaper`, `renderText`, and `onFetchPaper`
are the extension points.

Theming is a set of `--astra-*` overrides on `.astra-ui`; every token and its
defaults are listed in [TOKENS.md](./TOKENS.md). See the
[repository README](https://github.com/LightconeResearch/astra-ui#readme) for
the full integration guide and [CHANGELOG.md](./CHANGELOG.md) for migration
notes.
