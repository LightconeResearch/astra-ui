# `@lightcone-research/astra-ui`

Host-neutral React surfaces for the ASTRA project view model. The package owns
inventory, record detail, and result preview. It has no JupyterLab, MyST,
VS Code, filesystem, networking, or chat dependency.

`InventoryExplorer` is the canonical rich inventory surface. Pass it a
`ProjectViewModelV1` (plus an optional runtime overlay and `ViewerHost`).

Hosts provide the `ViewerHost` methods they support; resource IDs are resolved
into safe previews at that boundary. Import the component CSS separately:

```ts
import '@lightcone-research/lightcone-brand/theme.css';
import '@lightcone-research/astra-ui/styles.css';
```

Wrap surfaces in an `.astra-ui` element or use `AstraViewerProvider` inside
one. The shared CSS is scoped and follows host semantic variables.
