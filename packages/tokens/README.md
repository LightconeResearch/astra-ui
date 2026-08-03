# `@lightcone-research/astra-viewer-tokens`

Two CSS entry points are available:

- `@lightcone-research/astra-viewer-tokens/brand.css` provides the canonical
  ASTRA gold/slate/charcoal palette under an opt-in `.astra-brand` scope.
- `@lightcone-research/astra-viewer-tokens/theme.css` adds host-aware Jupyter
  and VS Code mappings plus the minimal `.astra-viewer` surface/focus base.

`theme.css` imports `brand.css`, so portable hosts normally need only the
second import. MyST publication themes can import `brand.css` alone and opt in
by placing `.astra-brand` on their publication wrapper.

Dark brand mode is selected with `data-astra-color-scheme="dark"` on an
`.astra-brand` wrapper. Portable viewers use `data-astra-theme="brand-light"`
or `data-astra-theme="brand-dark"`; without either, they follow host tokens.

Neither file styles `:root`, `html`, `body`, inventory UI, record components,
or host application chrome. Fonts are fallback stacks only; no network assets
are fetched.
