# `@lightcone-research/astra-viewer-react`

Host-neutral React surfaces for the ASTRA project view model. The package owns
inventory, record detail, and result preview. It has no JupyterLab, MyST,
VS Code, filesystem, networking, or chat dependency.

`InventoryExplorer` is the canonical rich inventory surface. Pass it a
`ProjectViewModelV1` (plus an optional runtime overlay and `ViewerHost`); its
legacy `snapshot` prop remains only as an adapter-compatible migration path.

Hosts provide capabilities through `ViewerHost`; in particular, resource IDs
are resolved into safe previews at the host boundary. Import the component CSS
separately:

```ts
import '@lightcone-research/astra-viewer-tokens/theme.css';
import '@lightcone-research/astra-viewer-react/styles.css';
```

Wrap surfaces in an `.astra-viewer` element or use `AstraViewerProvider` inside
one. The shared CSS is scoped and follows host semantic variables.
