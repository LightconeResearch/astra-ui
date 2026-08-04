# `@lightcone-research/astra-viewer-tokens`

Two CSS entry points are available:

- `@lightcone-research/astra-viewer-tokens/brand.css` provides ASTRA's compact
  warm-neutral palette and stable input, analysis, output, decision, finding,
  and insight colours under an opt-in `.astra-brand` scope.
- `@lightcone-research/astra-viewer-tokens/theme.css` applies that palette to
  portable `.astra-viewer` components, detects host light/dark mode, and keeps
  host typography without inheriting host colours.

`theme.css` imports `brand.css`, so portable hosts normally need only the
second import. MyST publication themes can import `brand.css` alone and opt in
by placing `.astra-brand` on their publication wrapper.

Dark brand mode is selected with `data-astra-color-scheme="dark"` on an
`.astra-brand` wrapper. Portable viewers use `data-astra-theme="brand-light"`
or `data-astra-theme="brand-dark"`; without either, they automatically choose
the complete ASTRA light or dark palette from the host's colour-scheme signal.

The primary portable roles are `--astra-canvas`, `--astra-panel`,
`--astra-raised`, `--astra-hover`, `--astra-rule-subtle`, `--astra-action`,
`--astra-focus`, and `--astra-artifact-paper`. Record-kind colours and their
`*-soft` fills are ASTRA-owned; generic action/focus colour is deliberately
separate from decision amber. The older `--astra-paper`, `--astra-surface`,
`--astra-surface-2`, and `--astra-accent` names remain compatibility aliases.
Host chrome can use the explicit aliases `--astra-color-canvas`,
`--astra-color-border-strong`, `--astra-radius-control`,
`--astra-radius-panel`, and `--astra-shadow-panel`. Artifact previews pair
`--astra-artifact-paper` with `--astra-artifact-ink` so their scientific canvas
stays legible in dark hosts.

Use `--astra-c-decision-ink` and `--astra-c-insight-ink` for small text. Their
corresponding base kind colours remain the canonical glyph, rule, and diagram
colours. Portable viewers switch the full surface, ink, action, and kind
palette when JupyterLab or VS Code reports a dark theme. Selecting an optional
ASTRA host theme is therefore never required to render components consistently.

Neither file styles `:root`, `html`, `body`, inventory UI, record components,
or host application chrome. Fonts are fallback stacks only; no network assets
are fetched.
