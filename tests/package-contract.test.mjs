import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const parse = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('the SDK is the sole owner of the canonical project model', async () => {
  const core = await readFile(new URL('../packages/react/src/core.ts', import.meta.url), 'utf8');
  const viewerTypes = await readFile(new URL('../packages/react/src/viewer-types.ts', import.meta.url), 'utf8');
  assert.match(core, /export \* from '@astra-spec\/sdk\/view-model'/);
  assert.doesNotMatch(viewerTypes, /interface ProjectViewModelV1|interface ProjectRecordView/);
});

test('the unified UI package uses host React and only portable rendering dependencies', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));
  assert.equal(manifest.name, '@lightcone-research/astra-ui');
  assert.equal(manifest.peerDependencies['@astra-spec/sdk'], '^0.0.5');
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  const names = Object.keys(manifest.dependencies ?? {});
  assert.deepEqual(names, ['@xyflow/react', 'katex']);
  assert.equal(names.some((name) => /jupyter|myst|vscode/i.test(name)), false);
  assert.ok(manifest.exports['./core']);
  assert.equal(manifest.exports['./ui.css'], './ui.css');
  assert.ok(manifest.files.includes('ui.css'));
});

test('graph is portable and contains no host or provider integration', async () => {
  const entry = await readFile(new URL('../packages/react/src/index.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../packages/react/styles.css', import.meta.url), 'utf8');
  const views = await readFile(new URL('../packages/react/views.css', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../packages/react/src/graph-view.tsx', import.meta.url), 'utf8');
  const flow = await readFile(new URL('../packages/react/src/graph-flow.tsx', import.meta.url), 'utf8');
  assert.match(entry, /graph-view/);
  assert.match(css, /views\.css/);
  assert.match(views, /graph\.css/);
  assert.match(graph, /astra-graph__record-popover/);
  assert.match(graph, /Open full details:/);
  assert.match(graph, /onOpenScope/);
  assert.match(graph, />\s*↗\s*</);
  assert.doesNotMatch(graph, /jupyter|myst|vscode|claude|codex|opencode/i);
  assert.doesNotMatch(flow, /dagre/i);
  assert.match(flow, /function nodeRanks/);
  assert.match(flow, /from '@xyflow\/react'/);
  assert.doesNotMatch(graph, /setPointerCapture|scrollLeft|onPointerMove|astra-graph__scrollplane/);
});

test('components layer never imports the application views layer', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));
  assert.ok(manifest.exports['./components']);
  assert.ok(manifest.exports['./views']);
  const components = await readFile(new URL('../packages/react/src/components.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(components, /graph-view|InventoryOutline|OverviewInventory|(Outputs|Decisions|Inputs|Findings|Papers)Inventory\b(?!\.js)/);
  const componentsCss = await readFile(new URL('../packages/react/components.css', import.meta.url), 'utf8');
  assert.doesNotMatch(componentsCss, /@import "\.\/(inventory|graph|views|styles)\.css"/);
  assert.match(componentsCss, /@import "\.\/ui\.css"/);
});

test('detail and preview behavior use native and canonical signals', async () => {
  const primitives = await readFile(
    new URL('../packages/react/src/full-inventory/InventoryPrimitives.tsx', import.meta.url),
    'utf8',
  );
  const recordDetail = await readFile(
    new URL('../packages/react/src/record-detail.tsx', import.meta.url),
    'utf8',
  );
  const resultViewer = await readFile(
    new URL('../packages/react/src/result-viewer.tsx', import.meta.url),
    'utf8',
  );
  const artifactPreview = await readFile(
    new URL('../packages/react/src/artifact-preview.tsx', import.meta.url),
    'utf8',
  );
  const inventoryPreview = await readFile(
    new URL('../packages/react/src/full-inventory/InventoryArtifactPreview.tsx', import.meta.url),
    'utf8',
  );
  const inventoryOutline = await readFile(
    new URL('../packages/react/src/full-inventory/InventoryOutline.tsx', import.meta.url),
    'utf8',
  );
  assert.match(primitives, /<dialog/);
  assert.match(primitives, /\.showModal\(\)/);
  assert.doesNotMatch(primitives, /document\.body|addEventListener\(['"]keydown/);
  assert.doesNotMatch(recordDetail, /capabilities\.(?:openSource|chatReference)/);
  assert.match(artifactPreview, /export function useResourcePreview/);
  assert.match(artifactPreview, /export function ArtifactPreview/);
  assert.match(artifactPreview, /missing_expected_result/);
  assert.doesNotMatch(resultViewer, /useEffect|missing_expected_result/);
  assert.doesNotMatch(inventoryPreview, /useCanonicalPreview|useEffect|missing_expected_result/);
  assert.match(inventoryOutline, /function InventoryRecordDetail/);
  assert.match(inventoryOutline, /switch \(record\.kind\)/);
});
