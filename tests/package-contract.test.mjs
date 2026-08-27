import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const sourceDirectory = new URL('../packages/react/src/', import.meta.url);
const parse = async (url) => JSON.parse(await readFile(url, 'utf8'));

async function sourceText(directory = sourceDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) chunks.push(await sourceText(new URL(`${entry.name}/`, directory)));
    if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
      chunks.push(await readFile(url, 'utf8'));
    }
  }
  return chunks.join('\n');
}

test('the package depends on the SDK model and host React only', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));

  assert.equal(manifest.name, '@lightcone-research/astra-ui');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.peerDependencies['@astra-spec/sdk'], '^0.0.8');
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts.prepack, 'npm run build');
  assert.ok(manifest.files.includes('LICENSE'));
  assert.equal(manifest.exports['./core'], undefined);
  assert.ok(manifest.exports['./components']);
  assert.ok(manifest.exports['./views']);
});

test('the published package includes the repository license', async () => {
  const repositoryLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
  const packageLicense = await readFile(new URL('../packages/react/LICENSE', import.meta.url), 'utf8');

  assert.equal(packageLicense, repositoryLicense);
  assert.match(packageLicense, /^BSD 3-Clause License$/m);
});

test('public subpaths resolve to built modules and expose the controlled API', async () => {
  const manifest = await parse(new URL('../packages/react/package.json', import.meta.url));
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (typeof target === 'string') continue;
    const modulePath = new URL(`../packages/react/${target.import.replace(/^\.\//, '')}`, import.meta.url);
    await readFile(modulePath);
    assert.ok(subpath === '.' || subpath.startsWith('./'));
  }

  const api = await import('../packages/react/dist/index.js');
  for (const name of [
    'ArtifactPreview',
    'InventoryExplorer',
    'OverviewInventory',
    'PaperDialog',
    'SurfaceHeader',
  ]) {
    assert.equal(typeof api[name], 'function', `${name} should be a public component`);
  }
  for (const retired of [
    'AstraViewerProvider',
    'createInventoryModel',
    'ProjectViewHeader',
    'ResultViewer',
    'useResourcePreview',
  ]) {
    assert.equal(retired in api, false, `${retired} should not remain public`);
  }

  const components = await import('../packages/react/dist/components.js');
  assert.equal('PapersInventory' in components, false);
  assert.equal(typeof components.PaperDialog, 'function');
  assert.equal(typeof components.collectInventoryPapers, 'function');
});

test('source contains no parallel resolver, session, storage, or integration layer', async () => {
  const source = await sourceText();

  assert.doesNotMatch(source, /@astra-spec\/sdk\/view-model/);
  assert.doesNotMatch(source, /RuntimeOverlay|ViewerSession|ViewerHost|ViewerChange/);
  assert.doesNotMatch(source, /ProjectViewModel|scopeId|recordId|knownRevision/);
  assert.doesNotMatch(source, /InventoryOpenReference|openReference|dialogsOnly/);
  assert.doesNotMatch(source, /createNodeFileAccess|createJupyterFileAccess|resolveAnalysis\s*\(/);
  assert.doesNotMatch(source, /from ['"](?:node:|@jupyter|myst-|katex)/i);
  assert.doesNotMatch(source, /PaperPdfViewer|pdf\.mjs|pdf\.worker/);
  assert.match(source, /indexAnalysis\(document\)/);
});

test('styles contain only the current component and inventory generations', async () => {
  const cssFiles = ['components.css', 'inventory.css', 'ui.css', 'views.css'];
  const css = (await Promise.all(cssFiles.map((file) => (
    readFile(new URL(`../packages/react/${file}`, import.meta.url), 'utf8')
  )))).join('\n');

  assert.doesNotMatch(css, /astra-record-detail|astra-result-viewer/);
  assert.doesNotMatch(css, /inventory-paper-pdf|katex|MyST|Jupyter/i);
  const views = await readFile(new URL('../packages/react/views.css', import.meta.url), 'utf8');
  assert.match(views, /@import "\.\/components\.css"/);
  assert.match(views, /@import "\.\/inventory\.css"/);
});

test('no temporary specification is included in the package workspace', async () => {
  const entries = await readdir(root);
  assert.equal(entries.includes('SPEC.md'), false);
  const packageEntries = await readdir(new URL('../packages/react/', import.meta.url));
  assert.equal(packageEntries.includes('SPEC.md'), false);
});
