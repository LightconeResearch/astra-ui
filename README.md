# ASTRA Viewer

`astra-viewer` is the host-neutral viewing layer for ASTRA projects. It gives
JupyterLab, a future VS Code extension, and other hosts one serializable model,
one set of inventory/result components, and one scoped design-token contract.

It is deliberately not a JupyterLab extension, a MyST theme, an execution
engine, or a claim that an analysis is scientifically correct.

## Packages

| Package | Owns | Does not own |
| --- | --- | --- |
| `@lightcone-research/astra-ui-model` | `ProjectViewModelV1`, runtime/materialization overlay, host capabilities, indexing, viewability diagnostics, compatibility projection | React, filesystem paths, URLs, credentials, artifact bytes |
| `@lightcone-research/astra-ui-react` | Inventory, record detail, safe result previews | JupyterLab, MyST, VS Code, chat, file access |
| `@lightcone-research/astra-brand` | Canonical ASTRA component palette with light/dark host detection | Paper layout, inventory layout, application chrome |

The graph view is a structural projection of inputs, decisions, outputs, and
sub-analyses; prior insights and findings remain available in inventory and
record-detail surfaces. Every relation between displayed records is preserved.
Each real ASTRA child scope is projected mechanically as one sub-analysis node
in its parent graph and opens into its own scoped graph. Declared child outputs
that are consumed outside that child scope are mechanically exposed beside the
sub-analysis node; internal-only outputs stay in the scoped graph. Decisions
sit at the top of a dedicated left rail and expose direct parameterization
links on hover or focus; indirect influence stays in record details. An optional
`astra.graph.yaml` can contract validated peer records,
including repeated boundary outputs, into presentation groups; it cannot create
scopes, dependencies, or stages. The
same model and React surface can be used by an interactive host or a static
exporter.

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

Hosts obtain the canonical model from the shared projector in
`@astra-spec/sdk` (`buildProjectViewModel` over a pluggable file-access
interface), so host implementations never become independent ASTRA parsers:
JupyterLab runs it in the browser over the contents API, VSCode and the MyST
build run it over Node fs.

## Styling

Portable viewers import:

```css
@import '@lightcone-research/astra-brand/theme.css';
@import '@lightcone-research/astra-ui-react/styles.css';
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
