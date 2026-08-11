# `@lightcone-research/astra-ui-react`

Host-neutral React surfaces for the ASTRA project view model. The package owns
inventory, record detail, and result preview. It has no JupyterLab, MyST,
VS Code, filesystem, networking, or chat dependency.

`InventoryExplorer` is the canonical rich inventory surface. Pass it a
`ProjectViewModelV1` (plus an optional runtime overlay and `ViewerHost`); its
presentation-shape `snapshot` prop remains only for standalone fixtures.

Hosts provide capabilities through `ViewerHost`; in particular, resource IDs
are resolved into safe previews at the host boundary. Import the component CSS
separately:

```ts
import '@lightcone-research/astra-brand/theme.css';
import '@lightcone-research/astra-ui-react/styles.css';
```

Wrap surfaces in an `.astra-ui` element or use `AstraViewerProvider` inside
one. The shared CSS is scoped and follows host semantic variables.
