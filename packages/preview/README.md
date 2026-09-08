# Preview

Renders the demo paper through [astra-theme](https://github.com/LightconeResearch/astra-theme)
against **this checkout's** `@astra-spec/ui` and exports it as a static site. CI runs it for
every pull request and posts the URL, so a UI change can be reviewed inside a real
[MyST](https://mystmd.org/) publication rather than in isolation.

```text
packages/react ──npm pack──▶ tarball ──npm install──▶ astra-theme/packages/astra
                                                          │ npm run build:article
                                                          ▼
myst_proto (astra.yaml + index.md) ──myst build --html──▶ dist/  (static site)
        with the MySTRA plugin              ▲
                                            └── site.template = the built theme
```

The theme bundles `@astra-spec/ui` into its Remix build, which is why a preview must rebuild
the theme rather than swap a package at runtime. The static export needs no server. It also includes the interactive playground at
`/playground/`, covering inventory, viewers, dialogs and inline glyphs. Both surfaces
use the exact Lightcone brand dependency selected in `packages/playground/package.json`;
the build installs that same dependency into its temporary theme checkout and records
it in `_preview.json`, together with a fingerprint of all CSS and font bytes. The
build fails if the two installations differ. To review coordinated PRs, pin the immutable brand preview URL
there and a compatible theme commit in `refs.json`.

## Local use

```bash
npm run preview                  # build against your working tree, then serve on :4310
npm run preview:build            # build only, into packages/preview/dist
node packages/preview/build.mjs --theme ../astra-theme --content ../myst_proto --serve
```

Flags: `--ui`, `--theme`, `--content` take a local directory or a git ref; `--mystra` takes a
bundle file or https URL, or a MySTRA checkout or git ref to bundle from source (`npm run bundle`); `--out`, `--cache`, `--base-url`, `--port`, `--keep-artifacts`, `--serve`.
Local checkouts are copied into the cache directory (`packages/preview/.cache/` unless `--cache`
or `PREVIEW_CACHE` says otherwise) and never modified. Dependencies and MyST's
cache in `.cache/` survive between runs, so a second build takes about a minute, dominated by
the theme's Remix build. The first run also clones the pinned theme and content and installs the
theme's dependencies.

## Pinned refs

`refs.json` fixes what the preview is built with:

| Field | Meaning |
| --- | --- |
| `theme.ref` | astra-theme tag, branch or commit; `theme.template` is the template directory to build |
| `content.ref` | commit of the MyST project (its `astra.yaml`, pages and `results/`) |
| `mystra.ref` | MySTRA git ref to bundle, or `null` to keep the pin in the content's `myst.yml` |
| `ui.repository` | only used when `--ui` names a ref instead of a checkout |

Bump a ref in a normal pull request; the preview for that PR shows the effect. A theme ref
must build with `npm` (the vendored astra-theme shells do) and its overlay must accept the UI
tarball installed over its published `@astra-spec/ui` dependency. If a UI change breaks the
theme's compile, the preview job fails, which is the intended signal: pass `--theme` (or the
workflow's `theme` input) a compatible astra-theme branch until it is released.

## What the export contains

`dist/` is `_build/html` from `myst build --html` plus:

- `robots.txt` disallowing everything and a `vercel.json` sending `X-Robots-Tag: noindex`,
  so previews are never indexed as a copy of the real publication;
- `trailingSlash: false` in `vercel.json`, because MyST links to `/page` and writes
  `page/index.html`; the local server in `serve.mjs` resolves paths the same way;
- `playground/`, the interactive stories built with the same content and brand;
- `_preview.json`, a manifest naming the UI, brand, theme, content and plugin that were built;
- font urls in the CSS bundles rewritten from the theme's `/myst_assets_folder/` public path to
  `/build/`, which `myst build --html` does for html, js and json but not for stylesheets;
- no binary science artifacts (`.npy`, `.h5`, `.fits`, ...): MyST copies every bound artifact,
  but the browser only loads images and tables, and the rest was 46 MB of the 77 MB export.
  `--keep-artifacts` keeps them, at the cost of download links in artifact cards.

## Screenshots and Argos

`screenshot.mjs paper` captures every page of `dist/` in light and dark mode at 1280, 960 and
640 px, plus the hover preview and the record dialog each reference kind opens, into
`screenshots/paper/`. `screenshot.mjs stories` builds the playground once and captures every
story in both themes into `screenshots/stories/`:

```bash
npm run preview:build && npm run preview:screenshots   # the paper
npm run screenshots                                    # the playground stories
```

The build regenerates the playground fixture and artifact copies from the pinned content.
The workflow captures the deployed playground with
`node packages/preview/screenshot.mjs stories --dir packages/preview/dist/playground`,
so Argos and the interactive preview show the same files. The capture checks that visible
glyphs inherit the Lightcone scope and use their semantic colour. It also checks the
19px/20px card inset, catching older host padding that would double it. It
uploads both directories to [Argos](https://argos-ci.com/) when an `ARGOS_TOKEN` secret exists. Argos compares
against the pull request's merge base, posts a status check and a comment, and offers a review UI;
the default branch is auto-approved as the baseline. Without the token the PNGs are uploaded as a
workflow artifact instead. Setup: create the project on argos-ci.com for this repository (installing
the Argos GitHub App), copy its token from *Settings → General* into the `ARGOS_TOKEN` secret.
Argos uploads only happen for astra-ui's own runs; callers keep the artifact. The free tier allows
5,000 screenshots a month; a build uploads 60.

## CI and Vercel

`.github/workflows/preview.yml` builds on every pull request and on pushes to `main`, then runs
`vercel deploy` from the static directory: pull requests get a preview URL in a sticky comment,
`main` is promoted to the project's production URL. Without the secrets below, and for pull
requests from forks, the job still builds and uploads `dist/` as a workflow artifact.

One-time setup:

1. Create a Vercel project in the team, for example
   `vercel project add astra-preview --scope lightcone-research`. No framework, build command or
   root directory is needed: the CLI uploads the finished static site.
2. Decide who may open previews. New projects protect preview deployments with Vercel
   Authentication by default; turn it off under *Settings → Deployment Protection* if reviewers
   without a Vercel account should be able to follow the links.
3. Create a token under *Account Settings → Tokens* scoped to the team, and read the ids from
   `vercel project ls` / the project settings (or run `vercel link` once and copy
   `.vercel/project.json`).
4. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as GitHub secrets. Organization
   secrets let astra-theme and MySTRA reuse the workflow with `secrets: inherit`.

Plan notes: the Hobby plan is for non-commercial use and caps CLI uploads at 100 MB and 15,000
files; the pruned export is about 31 MB in 1,350 files, uploaded as one archive.

### Calling the workflow from another repository

```yaml
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  preview:
    uses: LightconeResearch/astra-ui/.github/workflows/preview.yml@main
    with:
      theme: ${{ github.event.pull_request.head.sha }}   # astra-theme; MySTRA passes mystra:
    secrets: inherit
```

The called workflow checks out astra-ui at the `ui` input (default `main`) and builds with the
caller's ref substituted for the pinned one: `theme` is fetched and built, `mystra` is fetched and
bundled. The caller needs the three `VERCEL_*` secrets to deploy; otherwise it gets the artifact.
