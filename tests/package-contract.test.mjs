import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const packageRoot = new URL('../packages/react/', import.meta.url);
const sourceDirectory = new URL('src/', packageRoot);
const stylesDirectory = new URL('styles/', packageRoot);
const parse = async (url) => JSON.parse(await readFile(url, 'utf8'));

async function filesUnder(directory, pattern) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) files.push(...await filesUnder(new URL(`${entry.name}/`, directory), pattern));
    else if (pattern.test(entry.name)) files.push(url);
  }
  return files;
}

async function sourceText(directory = sourceDirectory) {
  const files = await filesUnder(directory, /\.[cm]?[jt]sx?$/);
  return (await Promise.all(files.map((url) => readFile(url, 'utf8')))).join('\n');
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

async function stylesText({ includeTokens = true } = {}) {
  const files = (await filesUnder(stylesDirectory, /\.css$/)).filter((url) => includeTokens || !url.pathname.endsWith('/tokens.css'));
  return stripComments((await Promise.all(files.map((url) => readFile(url, 'utf8')))).join('\n'));
}

test('the package depends on the SDK model and host React only', async () => {
  const manifest = await parse(new URL('package.json', packageRoot));

  assert.equal(manifest.name, '@lightcone-research/astra-ui');
  assert.match(manifest.version, /^\d+\.\d+\.\d+/);
  assert.equal(manifest.peerDependencies['@astra-spec/sdk'], '^0.0.8');
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts.prepack, 'npm run build');
  assert.ok(manifest.files.includes('LICENSE'));
  assert.ok(manifest.files.includes('src'), 'source ships for go-to-definition');
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(manifest.exports['.'], undefined, 'no root entry: import a layer');
  assert.equal(manifest.exports['./core'], undefined);
  for (const subpath of ['./components', './views', './ui', './ui/*', './data', './data/*', './records', './records/*', './inventory', './inventory/*', './styles/*', './package.json']) {
    assert.ok(manifest.exports[subpath], `${subpath} is exported`);
  }
});

test('the published package includes the repository license', async () => {
  const repositoryLicense = await readFile(new URL('LICENSE', root), 'utf8');
  const packageLicense = await readFile(new URL('LICENSE', packageRoot), 'utf8');

  assert.equal(packageLicense, repositoryLicense);
  assert.match(packageLicense, /^BSD 3-Clause License$/m);
});

test('every JS subpath resolves to a built module', async () => {
  const manifest = await parse(new URL('package.json', packageRoot));
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (typeof target === 'string' || subpath.includes('*')) continue;
    await readFile(new URL(target.import, packageRoot));
    await readFile(new URL(target.types, packageRoot));
  }
  const components = await import('../packages/react/dist/components.js');
  const views = await import('../packages/react/dist/views.js');
  for (const name of ['Button', 'Dialog', 'DetailDialog', 'ArtifactPreview', 'RecordDialog', 'useDetailStack', 'createInventoryIndex', 'PaperDialog']) {
    assert.ok(['function', 'object'].includes(typeof components[name]) && components[name], `${name} is a components export`);
  }
  for (const name of ['InventoryExplorer', 'AnalysisTree', 'OutputsInventory', 'InventorySection']) {
    assert.ok(['function', 'object'].includes(typeof views[name]) && views[name], `${name} is a views export`);
  }
  assert.equal('InventoryExplorer' in components, false);
  assert.equal('Dialog' in views, false);
});

test('the public export lists are explicit and stable', async () => {
  const snapshot = await parse(new URL('exports.snapshot.json', import.meta.url));
  const components = Object.keys(await import('../packages/react/dist/components.js')).sort();
  const views = Object.keys(await import('../packages/react/dist/views.js')).sort();
  assert.deepEqual({ components, views }, snapshot, 'update tests/exports.snapshot.json deliberately when the public API changes');
});

test('layers only depend downwards: ui <- data <- records <- inventory', async () => {
  const rules = [
    ['ui', /from '\.\.\/(data|records|inventory)\//],
    ['data', /from '\.\.\/(ui|records|inventory|lib)\//],
    ['records', /from '\.\.\/inventory\//],
  ];
  for (const [layer, forbidden] of rules) {
    const text = await sourceText(new URL(`${layer}/`, sourceDirectory));
    assert.doesNotMatch(text, forbidden, `${layer}/ must not import upwards`);
  }
});

test('source contains no parallel resolver, session, storage, or integration layer', async () => {
  const source = await sourceText();

  assert.doesNotMatch(source, /@astra-spec\/sdk\/view-model/);
  assert.doesNotMatch(source, /RuntimeOverlay|ViewerSession|ViewerHost|ViewerChange/);
  assert.doesNotMatch(source, /ProjectViewModel|scopeId|recordId|knownRevision/);
  assert.doesNotMatch(source, /createNodeFileAccess|createJupyterFileAccess|resolveAnalysis\s*\(/);
  assert.doesNotMatch(source, /from ['"](?:node:|@jupyter|myst-|katex)/i);
  assert.doesNotMatch(source, /PaperPdfViewer|pdf\.mjs|pdf\.worker/);
  assert.match(source, /indexAnalysis\(document\)/);
});

test('every token the styles consume is declared with a default', async () => {
  const tokens = await readFile(new URL('tokens.css', stylesDirectory), 'utf8');
  const declared = new Set([...tokens.matchAll(/^\s*(--astra-[a-z0-9-]+):/gm)].map(([, name]) => name));
  const css = await stylesText({ includeTokens: false });
  const local = new Set(['--astra-kind', '--astra-kind-ink', '--astra-kind-soft', '--astra-record-columns', '--astra-table-preview-max-height']);
  const consumed = new Set([...css.matchAll(/var\((--astra-[a-z0-9-]+)/g)].map(([, name]) => name));
  const missing = [...consumed].filter((name) => !declared.has(name) && !local.has(name));
  assert.deepEqual(missing, [], 'consumed tokens without a default in tokens.css');
  assert.doesNotMatch(css, /--astra-(ink|canvas|panel|raised|rule|muted|label|serif)\b/, 'components consume role names only');
});

test('styles are layered, scoped with :where, and free of theme or host selectors', async () => {
  const files = await filesUnder(stylesDirectory, /\.css$/);
  for (const url of files) {
    const css = stripComments(await readFile(url, 'utf8'));
    assert.match(css, /^@layer astra\.(tokens|base|components|views)/m, `${url.pathname} declares its layer`);
    assert.doesNotMatch(css, /^\s*\.astra-ui[\s.]/m, `${url.pathname} scopes with :where(.astra-ui)`);
    assert.doesNotMatch(css, /lightcone-brand|data-astra-theme|inventory-detail-dialog|astra-record-detail|astra-result-viewer/, `${url.pathname} has no legacy or theme selectors`);
  }
  for (const bundle of ['ui.css', 'components.css', 'views.css', 'styles.css']) {
    const css = await readFile(new URL(bundle, packageRoot), 'utf8');
    assert.match(css, /@import/, `${bundle} is an import bundle`);
  }
});

test('every class the components emit has a rule, and every styled block is emitted', async () => {
  const source = await sourceText();
  const css = await stylesText();
  const emitted = new Set([...source.matchAll(/['"`]([^'"`]*\bastra-[a-z0-9_-]+[^'"`]*)['"`]/g)]
    .flatMap(([, value]) => value.split(/\s+/))
    .filter((token) => /^astra-[a-z0-9_-]+$/.test(token)));
  const styled = new Set([...css.matchAll(/\.(astra-[a-z0-9_-]+)/g)].map(([, name]) => name));
  const styledBlocks = new Set([...styled].map((name) => name.replace(/(__|--).*/, '')));
  // A block root may exist only to scope its parts (e.g. astra-finding-detail__notes).
  const unstyled = [...emitted].filter((name) => !styled.has(name) && !name.startsWith('astra-ui') && !(name === name.replace(/(__|--).*/, '') && styledBlocks.has(name)));
  assert.deepEqual(unstyled, [], 'classes emitted by TSX with no CSS rule');
  const blocks = new Set([...styled].map((name) => name.replace(/(__|--).*/, '')));
  const orphanBlocks = [...blocks].filter((block) => block !== 'astra-ui' && ![...emitted].some((name) => name === block || name.startsWith(`${block}__`)));
  assert.deepEqual(orphanBlocks, [], 'CSS blocks no component emits');
});

test('no temporary specification is included in the package workspace', async () => {
  const entries = await readdir(root);
  assert.equal(entries.includes('SPEC.md'), false);
  const packageEntries = await readdir(packageRoot);
  assert.equal(packageEntries.includes('SPEC.md'), false);
});
