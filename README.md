# `@lightcone-research/astra-ui`

Composable React components for displaying resolved ASTRA analyses.

The package follows a shadcn/ui-like responsibility boundary: data flows in,
events flow out, and hosts compose the pieces they need. It does not parse
ASTRA files, resolve references, read artifacts, fetch papers, cache content,
or maintain an integration session.

## Responsibility boundary

| Layer | Owns |
| --- | --- |
| `@astra-spec/sdk` | Validation, recursive project resolution, canonical paths, aliases, selections, provenance, artifact bindings, DOI/path helpers, and optional indexes |
| `@lightcone-research/astra-ui` | Accessible presentation primitives, record dialogs, artifact/paper render slots, per-kind inventories, and an optional composed explorer |
| Host integration | `ProjectReader`, loading and refresh, artifact decoding and URLs, paper metadata/cache, navigation, and application state |

There is one ASTRA data model in downstream applications:
`ResolvedAnalysisDocument` from `@astra-spec/sdk`. astra-ui types its component
props directly with the SDK's `Resolved*` values and does not project a second
view model.

## Install

```bash
npm install @astra-spec/sdk @lightcone-research/astra-ui react react-dom
```

Version 0.2 requires `@astra-spec/sdk` 0.0.8 (peer range `^0.0.8`).

## Resolve once, then render

```tsx
import { resolveAnalysis } from '@astra-spec/sdk';
import { createNodeProjectReader } from '@astra-spec/sdk/node';
import {
  ArtifactPreview,
  InventoryExplorer,
  type ArtifactRenderer,
} from '@lightcone-research/astra-ui';
import '@lightcone-research/astra-ui/styles.css';

const bundle = await resolveAnalysis(createNodeProjectReader(projectRoot), {
  universeId: 'baseline',
});
const bindings = new Map(bundle.bindings.map((binding) => [binding.outputPath, binding]));

const renderArtifact: ArtifactRenderer = (output, { compact }) => {
  const binding = bindings.get(output.canonicalPath);
  if (!binding) return <ArtifactPreview output={output} compact={compact} />;

  return (
    <HostArtifactPreview
      output={output}
      path={binding.path}
      cacheToken={binding.cacheToken}
      compact={compact}
    />
  );
};

export function AnalysisView() {
  return (
    <div className="astra-ui">
      <InventoryExplorer
        document={bundle.document}
        renderArtifact={renderArtifact}
        onOpenArtifact={(output) => openArtifact(bindings.get(output.canonicalPath))}
      />
    </div>
  );
}
```

Artifact paths and cache tokens come from `bundle.bindings`; the UI never
guesses a path from an output id. Missing materializations remain ordinary
resolved outputs without an artifact descriptor.

## Controlled extension points

- `renderArtifact(output, { compact })` renders host-decoded artifact content.
- `renderText(text)` renders authored prose; plain text is the default.
- `renderPaper(paper, { focusEvidence })` renders host-owned paper content.
- `onFetchPaper(doi)` is an event. The host owns loading/error state and returns
  new `paperMetadata` props after its cache changes.
`OverviewInventory` is the recursive analysis picker. Per-kind inventory and
dialog components are also exported for hosts that prefer to compose their own
layout or router-owned detail state. `InventoryExplorer` is the optional
ready-made composition and owns its dialog stack locally.

## Entry points and styles

- `@lightcone-research/astra-ui/components` — primitives, dialogs, and renderers.
- `@lightcone-research/astra-ui/views` — the composed explorer and inventories.
- `components.css` — component and detail styles.
- `views.css` — components plus the complete inventory layout.
- `styles.css` — alias for the complete stylesheet.

All selectors are scoped below `.astra-ui`. React and the SDK are peer
dependencies, so a host supplies a single runtime and a single resolved model.

## Development

```bash
npm install
npm run typecheck
npm test
```

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
