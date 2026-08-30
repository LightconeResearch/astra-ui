# astra-ui token contract

Generated from `styles/tokens.css` by `scripts/tokens-doc.mjs`; do not edit by hand.

Every token is declared on `:where(.astra-ui)` at zero specificity in the `astra.tokens` layer. The bundled values are independent, brand-neutral fallbacks so the package remains usable on its own; external themes map their primitives onto these semantic roles under an explicit opt-in scope. Override tokens on the `.astra-ui` root with a later or unlayered rule, or on a descendant for a narrower scope; normal cascade and inheritance rules apply. Set `data-astra-color-scheme="light"` or `"dark"` on `.astra-ui`; `"dark"` selects the built-in dark palette and `"light"` uses the base palette. Leaving the attribute unset also uses the base palette. The package does not inspect host theme state: integrations map their host theme to this attribute and update it when that theme changes.

## Surfaces

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-color-canvas` | `#f8f7f3` | `#171614` |
| `--astra-color-surface` | `#ffffff` | `#1e1d1a` |
| `--astra-color-surface-raised` | `#ffffff` | `#272520` |
| `--astra-color-surface-muted` | `#f1efe9` | `#302d27` |
| `--astra-color-header` | `#f8f7f3` | `#302d27` |
| `--astra-color-artifact-paper` | `#ffffff` | `#f8f7f3` |
| `--astra-color-artifact-ink` | `#221f20` | `#221f20` |

## Text

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-color-text` | `#221f20` | `#f2eee7` |
| `--astra-color-text-muted` | `#4e5a70` | `#c4bdb2` |
| `--astra-color-text-subtle` | `#796d61` | `#a39b90` |
| `--astra-color-text-faint` | `#b8b0a8` | `#777168` |
| `--astra-color-eyebrow` | `#3f7280` | `#86adb7` |

## Borders

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-color-border-subtle` | `color-mix(in srgb, #8b7d70 10%, #f8f7f3)` | `#302d28` |
| `--astra-color-border` | `color-mix(in srgb, #8b7d70 18%, #f8f7f3)` | `#3b3731` |
| `--astra-color-border-strong` | `color-mix(in srgb, #8b7d70 38%, #f8f7f3)` | `#514b42` |

## Interaction

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-color-accent` | `#4e5a70` | `#aeb8ca` |
| `--astra-color-accent-contrast` | `#ffffff` | `#171614` |
| `--astra-color-link` | `var(--astra-color-accent)` | — |
| `--astra-color-focus` | `#3f7280` | `#86adb7` |
| `--astra-color-danger` | `#a45a43` | `#d6927d` |
| `--astra-color-danger-soft` | `rgb(164 90 67 / 0.09)` | `rgb(214 146 125 / 0.13)` |

## Record kinds

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-color-kind-input` | `#4e5a70` | `#aeb8ca` |
| `--astra-color-kind-analysis` | `#3f7280` | `#86adb7` |
| `--astra-color-kind-output` | `#3b7a73` | `#79b6ae` |
| `--astra-color-kind-decision` | `#a67c3c` | `#d8b477` |
| `--astra-color-kind-decision-ink` | `#765a2f` | `#d8b477` |
| `--astra-color-kind-finding` | `#a45a43` | `#d6927d` |
| `--astra-color-kind-insight` | `#8b7d70` | `#c2b5a9` |
| `--astra-color-kind-insight-ink` | `#4e5a70` | `#c2b5a9` |
| `--astra-color-kind-input-soft` | `rgb(78 90 112 / 0.1)` | `rgb(174 184 202 / 0.15)` |
| `--astra-color-kind-analysis-soft` | `rgb(63 114 128 / 0.1)` | `rgb(134 173 183 / 0.15)` |
| `--astra-color-kind-output-soft` | `rgb(59 122 115 / 0.1)` | `rgb(121 182 174 / 0.14)` |
| `--astra-color-kind-decision-soft` | `rgb(166 124 60 / 0.11)` | `rgb(216 180 119 / 0.14)` |
| `--astra-color-kind-finding-soft` | `rgb(164 90 67 / 0.1)` | `rgb(214 146 125 / 0.15)` |
| `--astra-color-kind-insight-soft` | `rgb(139 125 112 / 0.11)` | `rgb(194 181 169 / 0.15)` |

## Kind indirection

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-kind` | `var(--astra-color-accent)` | — |

## Typography

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-font-ui` | `"Source Serif 4", Georgia, "Times New Roman", serif` | — |
| `--astra-font-body` | `"Source Serif 4", Georgia, "Times New Roman", serif` | — |
| `--astra-font-heading` | `"Source Serif 4", Georgia, "Times New Roman", serif` | — |
| `--astra-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | — |
| `--astra-font-size` | `0.875rem` | — |

## Geometry

| Token | Light default | Dark default |
| --- | --- | --- |
| `--astra-radius-control` | `0` | — |
| `--astra-radius-preview` | `0.1875rem` | — |
| `--astra-shadow-raised` | `none` | `0 5px 18px rgb(0 0 0 / 0.38)` |
| `--astra-shadow-preview` | `0 6px 18px rgb(34 31 32 / 0.1)` | `0 6px 18px rgb(0 0 0 / 0.45)` |
| `--astra-width-preview` | `27.5rem` | — |
| `--astra-space-2` | `0.5rem` | — |
| `--astra-space-3` | `0.75rem` | — |
| `--astra-z-dialog` | `1000` | — |
| `--astra-z-preview` | `1100` | — |
| `--astra-z-fullscreen` | `10000` | — |

