# ASTRA 0.1 publication fixture

This DESI DR1 preview is adapted from
[`EiffL/myst_proto`](https://github.com/EiffL/myst_proto/tree/4bfccaf4d01e3a4cbf722069469aceab917a5cc6).
It keeps the paper's figures, tables, literature evidence and analysis identifiers
in an owned ASTRA 0.1 fixture so UI, MySTRA and theme changes can be tested together.
The upstream scientific project is unchanged.

The root drives the reconstruction and clustering analyses. Both declare the
parent, so navigation must handle a declaration graph with cycles. `baseline`
uses the original fiducial selections; `no_imaging_weights` exposes the existing
imaging-weight null test without supplying numerical results for it.

Downloaded data are outputs with materialization recipes. The original imported
output aliases are explicit publication-copy outputs, and imported decisions are
references to the parent. The tracked cosmology input is an LFS stand-in carrying
the original table's SHA-256 and size; its numerical bytes are not included.

Only the precomputed figures and tables needed by the paper are included. These
files have no ASTRA 0.1 provenance records: status correctly reports missing
records, while the publication can still display their bytes. No records or
alternative-universe measurements are fabricated. This fixture documents the
original jobs; it does not include the executable scientific pipeline or raw DESI
catalogs.

Regenerate the playground snapshot from the repository root with:

```sh
npm run fixture --workspace astra-ui-playground packages/preview/content
```
