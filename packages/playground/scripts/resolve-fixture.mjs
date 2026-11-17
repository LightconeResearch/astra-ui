// Resolve an ASTRA project with the SDK and write a playground fixture: the
// resolved report, its status report, and copies of the previewable result
// bytes under public/artifacts so Vite can serve them.
//
//   node scripts/resolve-fixture.mjs [projectRoot]
//
// projectRoot defaults to the content the preview pipeline pins (cloned into
// packages/preview/.cache/content by `npm run preview:build`, or under
// PREVIEW_CACHE), so the playground shows the same analysis as the paper.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readResults, resolve as resolveAnalysis, status } from '@astra-spec/sdk/node';
import { indexResolvedAnalysis } from '@astra-spec/sdk/reports';

const here = dirname(fileURLToPath(import.meta.url));
const previewCache = process.env.PREVIEW_CACHE ?? join(here, '../../preview/.cache');
const projectRoot = resolve(process.argv[2] ?? join(previewCache, 'content'));
if (!existsSync(join(projectRoot, 'astra.yaml'))) {
  throw new Error(`no astra.yaml in ${projectRoot}: run \`npm run preview:build\` first, or pass a project root`);
}
const fixturesDir = join(here, '../fixtures');
const artifactsDir = join(here, '../public/artifacts');
const PREVIEWABLE = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'csv', 'tsv', 'json', 'txt', 'md']);

const document = await resolveAnalysis(projectRoot, { offline: true });
const report = await status(projectRoot, { offline: true });
const index = indexResolvedAnalysis(document);

mkdirSync(fixturesDir, { recursive: true });
rmSync(artifactsDir, { recursive: true, force: true });
mkdirSync(artifactsDir, { recursive: true });

const artifacts = {};
for await (const { result, bytes, placeIndex } of readResults(projectRoot, { offline: true })) {
  const found = index.elementByRef.get(result.output);
  if (found?.collection !== 'outputs' || !PREVIEWABLE.has(found.element.format)) continue;
  // Result ids carry `#universe`; encode them into a safe file name.
  const target = `${Buffer.from(result.id).toString('base64url')}.${found.element.format}`;
  writeFileSync(join(artifactsDir, target), bytes);
  artifacts[result.id] = {
    url: `/artifacts/${target}`,
    path: result.places[placeIndex]?.file_path ?? '',
    format: found.element.format,
  };
}

writeFileSync(join(fixturesDir, 'desi.json'), `${JSON.stringify({ document, status: report, artifacts }, null, 2)}\n`);
console.log(`resolved ${projectRoot}: ${document.results.length} results, ${Object.keys(artifacts).length} artifacts copied`);
