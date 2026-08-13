# `@lightcone-research/astra-ui`

`@lightcone-research/astra-ui` is the host-neutral viewing layer for ASTRA
projects. It gives JupyterLab and other hosts one serializable project model,
one read-only inventory, reusable record dialogs, result previews, and a scoped
design-token contract.

It is not an ASTRA parser, execution engine, JupyterLab extension, paper theme,
or claim that an analysis is scientifically correct.

## Packages

| Package | Owns | Does not own |
| --- | --- | --- |
| `@astra-spec/sdk/view-model` | Canonical `ProjectViewModelV1` projection, indexing, and validation | React, host APIs, artifact bytes |
| `@lightcone-research/astra-ui/core` | Runtime overlays and host capability contracts | React components or host integrations |
| `@lightcone-research/astra-ui/components` | Portable record details and result previews | Application views and host APIs |
| `@lightcone-research/astra-ui/views` | The full ASTRA inventory and its record dialogs | JupyterLab or editor APIs |
| `@lightcone-research/lightcone-brand` | Canonical ASTRA component palette with light/dark host detection | Inventory layout or application chrome |

## Viewer behavior

The inventory presents outputs, decisions, inputs, findings, prior insights,
and cited papers for each ASTRA scope. Selecting a row opens a dialog inside the
inventory, so hosts do not need separate result or record tabs.

Output dialogs can preview declared metrics and materialized resources supplied
by the host. Missing outputs remain visible with the expected result path; the
viewer does not execute an analysis or write into its project directory.

Cited papers are cache-first. A host may provide `onFetchPaper` to handle an
explicit **Fetch paper** action and return cache-backed metadata and a PDF URL.
The shared UI does not fetch directly from arXiv or write to disk itself.

## Host flow

1. A trusted host adapter reads `astra.yaml`, resolved child analyses, the
   active universe, and result metadata.
2. It projects those sources into `ProjectViewModelV1` plus an optional
   `RuntimeOverlayV1`. The model contains resource descriptors, never local
   paths or artifact bytes.
3. The host implements only the `ViewerHost` preview, download, source, or
   external-navigation methods it supports.
4. React renders the same inventory everywhere and requests previews lazily by
   stable resource ID.
5. Hosts publish source, selection, materialization, and resource revisions so
   the inventory can refresh without reparsing ASTRA independently.

The shared projector lives in `@astra-spec/sdk` (`buildProjectViewModel` over a
pluggable file-access interface).

## Styling

Portable viewers import:

```css
@import '@lightcone-research/lightcone-brand/theme.css';
@import '@lightcone-research/astra-ui/styles.css';
```

The `.astra-ui` scope supplies the ASTRA component palette in light and dark
hosts. A host theme may style surrounding application chrome separately.

## Development

```bash
npm install
npm test
npm run typecheck
```

React is a peer dependency (`>=18 <20`) so hosts supply one React runtime.
Published Jupyter wheels bundle the compiled viewer; end users do not install
Node packages separately.
