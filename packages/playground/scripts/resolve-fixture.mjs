// Resolve an ASTRA project with the SDK and write a playground fixture:
// the ResolvedAnalysisDocument, its artifact bindings, and copies of the
// bound artifact files under public/artifacts so Vite can serve them.
//
//   node scripts/resolve-fixture.mjs [projectRoot] [universeId]
//
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAnalysis } from '@astra-spec/sdk';
import { createNodeProjectReader } from '@astra-spec/sdk/node';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(process.argv[2] ?? join(here, '../../../../desi-myst-proto'));
const universeId = process.argv[3] ?? 'baseline';
const fixturesDir = join(here, '../fixtures');
const artifactsDir = join(here, '../public/artifacts');
const PREVIEWABLE = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'csv', 'tsv', 'json', 'txt', 'md']);

const bundle = await resolveAnalysis(createNodeProjectReader(projectRoot), { universeId });

mkdirSync(fixturesDir, { recursive: true });
mkdirSync(artifactsDir, { recursive: true });

const artifacts = {};
for (const binding of bundle.bindings) {
  const source = join(projectRoot, binding.path);
  if (!existsSync(source)) continue;
  const extension = binding.path.split('.').pop();
  if (!PREVIEWABLE.has(extension)) continue;
  const target = `${binding.outputPath}.${extension}`;
  cpSync(source, join(artifactsDir, target));
  artifacts[binding.outputPath] = { url: `/artifacts/${target}`, path: binding.path, format: extension };
}

writeFileSync(
  join(fixturesDir, 'desi.json'),
  JSON.stringify({ document: bundle.document, artifacts }, null, 2),
);
console.log(`resolved ${projectRoot} (${universeId}): ${bundle.bindings.length} bindings, ${Object.keys(artifacts).length} artifacts copied`);
