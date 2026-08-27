# `@lightcone-research/astra-ui`

Controlled React components for `ResolvedAnalysisDocument` from
`@astra-spec/sdk`.

```tsx
import { InventoryExplorer } from '@lightcone-research/astra-ui/views';
import '@lightcone-research/astra-ui/views.css';

<div className="astra-ui">
  <InventoryExplorer
    document={bundle.document}
    renderArtifact={(output, options) => (
      <HostArtifact output={output} options={options} />
    )}
  />
</div>
```

The package owns presentation only. The host resolves ASTRA with the SDK and
owns files, artifact bytes and URLs, cache invalidation, paper fetching,
loading state, and navigation. Use `renderArtifact`, `renderPaper`, and
`renderText` for host-specific content; their inputs remain direct SDK values.

Import `@lightcone-research/astra-ui/components` for individual primitives and
dialogs, or `@lightcone-research/astra-ui/views` for the optional composed
inventory. See the repository README for the complete integration contract.
