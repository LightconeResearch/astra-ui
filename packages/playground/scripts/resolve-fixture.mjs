// Generate browser-safe reports and resource URLs from the owned ASTRA 0.1 demo.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve as resolveAnalysis, status, readResults } from '@astra-spec/sdk/node';
import { indexResolvedAnalysis, getResultOwner } from '@astra-spec/sdk/reports';
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(process.argv[2] ?? join(here, '../../preview/content'));
const fixturesDir = join(here, '../fixtures'),
  artifactsDir = join(here, '../public/artifacts');
const previewable = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'csv', 'tsv', 'json', 'txt', 'md']);
const document = await resolveAnalysis(projectRoot, { offline: true });
const report = await status(projectRoot, { offline: true });
const index = indexResolvedAnalysis(document);
mkdirSync(fixturesDir, { recursive: true });
rmSync(artifactsDir, { recursive: true, force: true });
mkdirSync(artifactsDir, { recursive: true });
const artifacts = {};
for await (const { result, bytes, placeIndex } of readResults(projectRoot, { offline: true })) {
  const found = index.elementByRef.get(result.output);
  if (found?.collection !== 'outputs' || !previewable.has(found.element.format)) continue;
  const target = `${Buffer.from(result.id).toString('base64url')}.${found.element.format}`;
  writeFileSync(join(artifactsDir, target), bytes);
  artifacts[result.id] = {
    url: `/artifacts/${target}`,
    path: result.places[placeIndex]?.file_path ?? '',
    format: found.element.format,
    analysisKey: getResultOwner(index, result.id)?.key ?? '',
  };
}
writeFileSync(join(fixturesDir, 'desi.json'), JSON.stringify({ document, status: report, artifacts }, null, 2) + '\n');
console.log(
  `Resolved ${document.analyses.length} analyses and ${document.results.length} results; copied ${Object.keys(artifacts).length} resources.`,
);
