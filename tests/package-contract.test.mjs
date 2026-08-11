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

test('the unified UI package uses host React and has no host dependency', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));
  assert.equal(manifest.name, '@lightcone-research/astra-ui');
  assert.equal(manifest.peerDependencies['@astra-spec/sdk'], '^0.0.5');
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  const names = Object.keys(manifest.dependencies ?? {});
  assert.deepEqual(names, []);
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
  assert.match(entry, /graph-view/);
  assert.match(css, /views\.css/);
  assert.match(views, /graph\.css/);
  assert.match(graph, /astra-graph__record-popover/);
  assert.match(graph, /Open full details:/);
  assert.match(graph, /onOpenScope/);
  assert.match(graph, />\s*↗\s*</);
  assert.doesNotMatch(graph, /jupyter|myst|vscode|claude|codex|opencode/i);
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
