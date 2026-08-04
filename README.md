# ASTRA Viewer

`astra-viewer` is the host-neutral viewing layer for ASTRA projects. It gives
JupyterLab, a future VS Code extension, and other hosts one serializable model,
one set of inventory/result components, and one scoped design-token contract.

It is deliberately not a JupyterLab extension, a MyST theme, an execution
engine, or a claim that an analysis is scientifically correct.

## Packages

| Package | Owns | Does not own |
| --- | --- | --- |
| `@lightcone-research/astra-viewer-model` | `ProjectViewModelV1`, runtime/materialization overlay, host capabilities, indexing, viewability diagnostics, compatibility projection | React, filesystem paths, URLs, credentials, artifact bytes |
| `@lightcone-research/astra-viewer-react` | Inventory, record detail, safe result previews | JupyterLab, MyST, VS Code, chat, file access |
| `@lightcone-research/astra-viewer-tokens` | Canonical ASTRA component palette with light/dark host detection | Paper layout, inventory layout, application chrome |

The graph view is intentionally deferred. Relations are preserved in the model
so a graph can be added later without changing the host protocol.

## Host flow

1. A trusted host adapter reads `astra.yaml`, resolved child analyses, the
   selected universe, and result metadata.
2. It projects those sources into `ProjectViewModelV1` plus an optional
   `RuntimeOverlayV1`. The serializable model contains resource descriptors,
   never local paths or bytes.
3. The host implements `ViewerHost` for preview, download, source navigation,
   universe changes, execution, or chat references that it supports.
4. React surfaces render the same model everywhere. Resource previews are
   requested lazily by stable resource ID.
5. Hosts publish analysis, selection, materialization, and resource changes
   through revisions. A changed artifact revision invalidates its preview
   without pretending that `astra.yaml` itself changed.

The current Jupyter adapter has a transitional Python projector because the
ASTRA CLI does not yet emit a standardized viewer bundle. The compatibility
projector is isolated at this boundary; the long-term target is for the ASTRA
SDK/CLI to emit the canonical model input so host implementations do not become
independent ASTRA parsers.

## Styling

Portable viewers import:

```css
@import '@lightcone-research/astra-viewer-tokens/theme.css';
@import '@lightcone-research/astra-viewer-react/styles.css';
```

The `.astra-viewer` scope keeps the complete ASTRA component palette in every
host, selecting its accessible light or dark variant from the host colour
scheme. MyST paper themes import only `brand.css` and opt in with
`.astra-brand`; they do not import inventory/result application layout. A host
theme may style surrounding application chrome, but is not required for the
React components.

## Development

```bash
npm install
npm test
npm run typecheck
```

React is a peer dependency (`>=18 <20`) so hosts supply one React runtime.
Published Jupyter wheels bundle the compiled viewer; end users do not install
Node packages separately.
