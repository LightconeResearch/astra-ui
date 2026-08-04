import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const parse = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('model package is host and framework neutral', async () => {
  const manifest = await parse(new URL('../packages/model/package.json', import.meta.url));
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.peerDependencies, undefined);
});

test('React package uses host React and has no MyST, Jupyter, or IDE dependency', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  const names = Object.keys(manifest.dependencies ?? {});
  assert.deepEqual(names, ['@lightcone-research/astra-viewer-model']);
  assert.equal(names.some((name) => /jupyter|myst|vscode/i.test(name)), false);
});

test('graph ships from the shared viewer without a host-specific dependency', async () => {
  const entry = await readFile(new URL('../packages/react/src/index.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../packages/react/styles.css', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../packages/react/src/graph.tsx', import.meta.url), 'utf8');
  assert.match(entry, /graph/i);
  assert.match(css, /graph\.css/i);
  assert.doesNotMatch(graph, /jupyter|myst|vscode/i);
  assert.match(graph, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(graph, /x: current\.x - horizontalDelta/);
  assert.match(graph, /y: current\.y - verticalDelta/);
});
