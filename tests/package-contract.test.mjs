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

function ruleBody(css, marker) {
  const selector = css.indexOf(marker);
  assert.notEqual(selector, -1, `missing CSS rule: ${marker}`);
  const start = css.indexOf('{', selector) + 1;
  let depth = 1;
  let end = start;
  while (depth && end < css.length) {
    if (css[end] === '{') depth += 1;
    else if (css[end] === '}') depth -= 1;
    end += 1;
  }
  assert.equal(depth, 0, `unclosed CSS rule: ${marker}`);
  return css.slice(start, end - 1);
}

const tokenValues = (body) => new Map([...body.matchAll(/^\s*(--astra-[a-z0-9-]+):\s*([^;]+);/gm)]
  .map(([, name, value]) => [name, value.trim()]));

function relativeLuminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is not a six-digit sRGB colour`);
  const [red, green, blue] = hex.slice(1).match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function stylesText({ includeTokens = true } = {}) {
  const files = (await filesUnder(stylesDirectory, /\.css$/)).filter((url) => includeTokens || !url.pathname.endsWith('/tokens.css'));
  return stripComments((await Promise.all(files.map((url) => readFile(url, 'utf8')))).join('\n'));
}

test('the package depends on the SDK model, floating positioning, and host React only', async () => {
  const manifest = await parse(new URL('package.json', packageRoot));

  assert.equal(manifest.name, '@astra-spec/ui');
  assert.match(manifest.version, /^\d+\.\d+\.\d+/);
  assert.equal(manifest.peerDependencies['@astra-spec/sdk'], '^0.1.1');
  assert.equal(manifest.peerDependencies.react, '>=18 <20');
  assert.equal(manifest.peerDependencies['react-dom'], '>=18 <20');
  assert.deepEqual(manifest.dependencies, {
    '@floating-ui/react': '^0.27.20',
    katex: '^0.16.47',
  }, 'Floating UI positions accessible previews and KaTeX typesets authored math');
  assert.equal(manifest.scripts.prepack, 'npm run build');
  assert.ok(manifest.files.includes('LICENSE'));
  assert.ok(manifest.files.includes('src'), 'source ships for go-to-definition');
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(manifest.exports['.'], undefined, 'no root entry: import a layer');
  assert.equal(manifest.exports['./core'], undefined);
  for (const subpath of ['./primitives', './primitives/*', './components', './components/*', './blocks', './blocks/*', './views', './views/*', './model', './model/*', './styles/*', './package.json']) {
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
  for (const subpath of ['primitives/button', 'primitives/dialog', 'primitives/preview-popover', 'model/relations', 'components/output-dialog', 'components/record-preview', 'components/use-detail-stack', 'blocks/outputs-list', 'views/inventory']) {
    const target = manifest.exports[`./${subpath.split('/')[0]}/*`].import.replace('*', subpath.split('/')[1]);
    await readFile(new URL(target, packageRoot));
  }
  const layers = Object.fromEntries(await Promise.all(['primitives', 'components', 'blocks', 'views', 'model'].map(async (layer) => [layer, await import(`../packages/react/dist/${layer}/index.js`)])));
  const expected = {
    primitives: ['Button', 'Dialog', 'DetailDialog', 'PreviewPopover', 'RecordList', 'cn'],
    components: ['ArtifactPreview', 'OutputDialog', 'OutputDetail', 'RecordDialog', 'RecordPreview', 'useDetailStack'],
    blocks: ['OutputsList', 'InventorySection', 'InventoryOutline', 'AnalysisTree'],
    views: ['Inventory'],
    model: ['locateRecord', 'outputRelations', 'collectInventoryPapers'],
  };
  for (const [layer, names] of Object.entries(expected)) {
    for (const name of names) assert.ok(['function', 'object'].includes(typeof layers[layer][name]) && layers[layer][name], `${name} is a ${layer} export`);
  }
  assert.equal('Inventory' in layers.components, false);
  assert.equal('Dialog' in layers.views, false);
});

test('the public export lists are explicit and stable', async () => {
  const snapshot = await parse(new URL('exports.snapshot.json', import.meta.url));
  const actual = {};
  for (const layer of ['primitives', 'components', 'blocks', 'views', 'model']) {
    actual[layer] = Object.keys(await import(`../packages/react/dist/${layer}/index.js`)).sort();
  }
  assert.deepEqual(actual, snapshot, 'update tests/exports.snapshot.json deliberately when the public API changes');
});

test('layers only depend downwards: lib <- primitives <- model <- components <- blocks <- views', async () => {
  const rules = [
    ['lib', /from '\.\.\/(primitives|model|components|blocks|views)\//],
    ['primitives', /from '\.\.\/(model|components|blocks|views)\//],
    ['model', /from '\.\.\/(lib|primitives|components|blocks|views)\//],
    ['components', /from '\.\.\/(blocks|views)\//],
    ['blocks', /from '\.\.\/views\//],
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
  assert.doesNotMatch(source, /from ['"](?:node:|@jupyter|myst-)/i);
  // Rendering dependencies stay confined to the primitives that own them.
  const katexImports = [...source.matchAll(/from ['"]katex['"]/g)].length;
  assert.equal(katexImports, 1, 'katex is imported once, by primitives/prose.tsx');
  assert.match(await readFile(new URL('primitives/prose.tsx', sourceDirectory), 'utf8'), /from 'katex'/);
  const floatingImports = [...source.matchAll(/from ['"]@floating-ui\/react['"]/g)].length;
  assert.equal(floatingImports, 1, 'Floating UI is imported once, by primitives/preview-popover.tsx');
  assert.match(await readFile(new URL('primitives/preview-popover.tsx', sourceDirectory), 'utf8'), /from '@floating-ui\/react'/);
  assert.doesNotMatch(source, /PaperPdfViewer|pdf\.mjs|pdf\.worker/);
  assert.match(source, /indexAnalysis\(document\)/);
});

test('every token the styles and playground consume is declared with a default', async () => {
  const tokens = await readFile(new URL('tokens.css', stylesDirectory), 'utf8');
  const declared = new Set([...tokens.matchAll(/^\s*(--astra-[a-z0-9-]+):/gm)].map(([, name]) => name));
  const css = await stylesText({ includeTokens: false });
  const source = await sourceText();
  const playgroundSource = await sourceText(
    new URL('../packages/playground/src/', import.meta.url)
  );
  // Element-local tokens: declared inside a component sheet or set from TSX.
  const local = new Set([
    ...[...css.matchAll(/^\s*(--astra-[a-z0-9-]+):/gm)].map(([, name]) => name),
    ...[...source.matchAll(/'(--astra-[a-z0-9-]+)'/g)].map(([, name]) => name),
  ]);
  const consumed = new Set([...css.matchAll(/var\((--astra-[a-z0-9-]+)/g)].map(([, name]) => name));
  const missing = [...consumed].filter((name) => !declared.has(name) && !local.has(name));
  assert.deepEqual(missing, [], 'consumed tokens without a default in tokens.css');
  const consumedByPlayground = new Set(
    [...playgroundSource.matchAll(/var\((--astra-[a-z0-9-]+)/g)]
      .map(([, name]) => name)
  );
  assert.deepEqual(
    [...consumedByPlayground].filter((name) => !declared.has(name)),
    [],
    'playground tokens without a default in tokens.css'
  );
  const consumedByTokens = new Set([...stripComments(tokens).matchAll(/var\((--astra-[a-z0-9-]+)/g)].map(([, name]) => name));
  assert.deepEqual([...consumedByTokens].filter((name) => !declared.has(name)), [], 'tokens.css composes only ASTRA role tokens it declares');
  const unused = [...declared].filter((name) => !consumed.has(name) && !consumedByTokens.has(name) && !source.includes(`'${name}'`));
  assert.deepEqual(unused, [], 'tokens declared in tokens.css that nothing consumes');
  assert.doesNotMatch(css, /--astra-(ink|canvas|panel|raised|rule|muted|label|serif)\b/, 'components consume role names only');
});

test('subtle text meets WCAG AA against the built-in canvas and surface', async () => {
  const css = await readFile(new URL('tokens.css', stylesDirectory), 'utf8');
  const schemes = [
    ['light', tokenValues(ruleBody(css, ':where(.astra-ui) {'))],
    ['dark', tokenValues(ruleBody(css, ':where(.astra-ui[data-astra-color-scheme="dark"])'))],
  ];
  for (const [scheme, values] of schemes) {
    const foreground = values.get('--astra-color-text-subtle');
    for (const backgroundToken of ['--astra-color-canvas', '--astra-color-surface']) {
      const background = values.get(backgroundToken);
      const ratio = contrastRatio(foreground, background);
      assert.ok(ratio >= 4.5, `${scheme} text-subtle on ${backgroundToken} is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
    }
  }
});

test('the colour-scheme contract is explicit and host-neutral', async () => {
  const css = stripComments(await readFile(new URL('tokens.css', stylesDirectory), 'utf8'));
  const darkMarker = ':where(.astra-ui[data-astra-color-scheme="dark"])';
  const darkStart = css.indexOf(darkMarker);
  assert.notEqual(darkStart, -1, 'the dark palette has a public selector');
  const darkSelector = css.slice(darkStart, css.indexOf('{', darkStart)).trim();
  assert.equal(darkSelector, darkMarker, 'only the explicit ASTRA dark attribute selects the dark palette');
  assert.equal([...css.matchAll(/data-astra-color-scheme/g)].length, 1, 'tokens.css has no implicit or competing scheme selectors');
  assert.doesNotMatch(css, /(?:data-jp-|--jp-|\.jp-|vscode|--vscode-|forced-colors)/i,
    'tokens.css contains no JupyterLab, VS Code, or forced-colour host adapter');

  const readme = await readFile(new URL('README.md', packageRoot), 'utf8');
  const tokenDocs = await readFile(new URL('TOKENS.md', packageRoot), 'utf8');
  for (const [name, documentation] of [['README.md', readme], ['TOKENS.md', tokenDocs]]) {
    assert.match(documentation, /data-astra-color-scheme="light"/,
      `${name} documents the explicit light scheme`);
    assert.match(documentation, /or `"dark"`/,
      `${name} documents the explicit dark scheme`);
    assert.match(documentation, /integration[s]?\s+map[s]?\s+(?:its|their)\s+host theme to\s+this attribute/i,
      `${name} assigns host theme detection to integrations`);
    assert.doesNotMatch(documentation, /JupyterLab|VS Code|forced.colou?r/i,
      `${name} keeps the public theme contract host-neutral`);
  }
});

test('the playground opts into its external brand explicitly', async () => {
  const provider = await readFile(
    new URL('../packages/playground/.ladle/components.tsx', import.meta.url),
    'utf8'
  );
  const manifest = JSON.parse(await readFile(
    new URL('../packages/playground/package.json', import.meta.url),
    'utf8'
  ));

  assert.equal(
    manifest.devDependencies['@lightcone-research/brand'],
    '^0.0.2'
  );
  assert.match(provider, /import\('@lightcone-research\/brand\/adapters\/astra\.css'\)/);
  assert.match(
    provider,
    /\? 'astra-ui lightcone-brand playground-root'/,
    'the branded playground adds the brand scope to its ASTRA root'
  );
  assert.match(provider, /data-astra-color-scheme=\{scheme\}/);
  assert.match(
    provider,
    /data-lightcone-color-scheme=\{brand \? scheme : undefined\}/,
    'the playground only sets the generic Lightcone scheme contract when its brand is active'
  );
  assert.doesNotMatch(provider, /data-astra-theme/);
});

test('styles are layered, scoped with :where, and free of theme or host selectors', async () => {
  const files = await filesUnder(stylesDirectory, /\.css$/);
  for (const url of files) {
    const css = stripComments(await readFile(url, 'utf8'));
    assert.match(css, /^@layer astra\.tokens, astra\.base, astra\.components, astra\.views;/m, `${url.pathname} declares the layer order first`);
    assert.match(css, /^@layer astra\.(tokens|base|components|views) \{/m, `${url.pathname} wraps its rules in a layer`);
    assert.doesNotMatch(css, /__DEAD__/, `${url.pathname} has no placeholder selectors`);
    assert.doesNotMatch(css, /^\s*\.astra-ui[\s.]/m, `${url.pathname} scopes with :where(.astra-ui)`);
    assert.doesNotMatch(css, /lightcone-brand|data-astra-theme|inventory-detail-dialog|astra-record-detail|astra-result-viewer/, `${url.pathname} has no legacy or theme selectors`);
    assert.doesNotMatch(css, /data-jp-|--jp-|\.jp-|vscode|--vscode-|forced-colors/i, `${url.pathname} has no host-specific selectors or tokens`);
  }
  for (const bundle of ['primitives.css', 'components.css', 'blocks.css', 'views.css', 'styles.css']) {
    const css = await readFile(new URL(bundle, packageRoot), 'utf8');
    assert.match(css, /@import/, `${bundle} is an import bundle`);
  }
  // Within a layer, later sheets override earlier ones at equal specificity;
  // primitives.css follows the legacy source order (surface-header before dialog, ...).
  const primitives = await readFile(new URL('primitives.css', packageRoot), 'utf8');
  const imports = [...primitives.matchAll(/@import "\.\/styles\/primitives\/([a-z-]+)\.css"/g)].map(([, name]) => name);
  assert.deepEqual(imports, ['kind', 'surface-header', 'badge', 'button', 'preview-popover', 'dialog', 'detail-layout', 'relation-list', 'count-heading', 'record-list', 'empty-state', 'prose'], 'primitives.css import order is part of the cascade');
  const components = await readFile(new URL('components.css', packageRoot), 'utf8');
  assert.match(components, /@import "\.\/styles\/components\/record-preview\.css";/, 'components.css ships record preview styles');
});

// Innermost `selector { declarations }` pairs anywhere in a sheet, including
// inside @layer, @media, and @container blocks.
const rules = (css) => [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map(([, selector, declarations]) => [selector.trim(), declarations]);

test('the intentionally low-contrast faint token is decorative only', async () => {
  const consumers = [];
  for (const url of await filesUnder(stylesDirectory, /\.css$/)) {
    if (url.pathname.endsWith('/tokens.css')) continue;
    for (const [selector, declarations] of rules(stripComments(await readFile(url, 'utf8')))) {
      if (declarations.includes('var(--astra-color-text-faint)')) consumers.push([url.pathname, selector]);
    }
  }
  assert.ok(consumers.length > 0, 'text-faint remains a documented decorative role');
  for (const [pathname, selector] of consumers) {
    assert.match(selector, /__arrow\b/, `${pathname}: ${selector} uses text-faint for user-facing text; use text-subtle or split the role`);
  }
});

// The body of every `@container ... { ... }` block in a sheet.
function containerBlocks(css) {
  const blocks = [];
  for (const match of css.matchAll(/@container[^{]*\{/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;
    while (depth && index < css.length) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
  }
  return blocks;
}

// The `astra-*` class of a selector's subject (its last compound), if any.
const subjectClass = (selector) => selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).at(-1)?.match(/\.(astra-[a-z0-9_-]+)/)?.[1];

test('every sheet that queries @container has a query container in the block that owns the rules', async () => {
  const sheets = new Map();
  for (const url of await filesUnder(stylesDirectory, /\.css$/)) {
    sheets.set(url.pathname.slice(stylesDirectory.pathname.length), stripComments(await readFile(url, 'utf8')));
  }
  const containersOf = (css) => new Set(rules(css)
    .filter(([, declarations]) => /container-type\s*:\s*inline-size/.test(declarations))
    .map(([selector]) => subjectClass(selector)));
  // Sheets whose @container rules style descendants of a container another
  // sheet declares; every one of their queried selectors must name that class.
  const delegated = {
    'blocks/decisions-list.css': ['blocks/records.css', 'astra-inventory-records'],
    'components/output-detail.css': ['primitives/dialog.css', 'astra-dialog'],
    'components/paper-detail.css': ['primitives/dialog.css', 'astra-dialog'],
  };
  const queried = [];
  for (const [sheet, css] of sheets) {
    const blocks = containerBlocks(css);
    if (!blocks.length) continue;
    queried.push(sheet);
    const [owner, containerClass] = delegated[sheet] ?? [sheet];
    const containers = containersOf(sheets.get(owner));
    assert.ok(containers.size, `${sheet} uses @container, so ${owner} must declare container-type: inline-size on the block's root class: a block mounted on its own (outside <Inventory>) has no ancestor container and its rows would never collapse`);
    if (containerClass) assert.ok(containers.has(containerClass), `${owner} declares .${containerClass} as the container that ${sheet} queries`);
    for (const selector of blocks.flatMap((block) => rules(block).flatMap(([list]) => list.split(',').map((one) => one.trim())))) {
      if (containerClass) assert.ok(selector.includes(`.${containerClass}`), `${sheet}: "${selector}" is scoped under .${containerClass}, the container it queries`);
      assert.ok(!containers.has(subjectClass(selector)), `${sheet}: "${selector}" styles the container itself; a container query only ever matches descendants`);
    }
  }
  assert.deepEqual(queried.sort(), [
    'blocks/decisions-list.css', 'blocks/outputs-list.css', 'blocks/papers-list.css', 'blocks/records.css',
    'components/output-detail.css', 'components/paper-detail.css',
    'primitives/dialog.css', 'primitives/record-list.css', 'views/inventory.css',
  ], 'the sheets that use @container (extend the list, and this test, deliberately)');
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
  // Template-literal class prefixes (e.g. `astra-evidence__glyph--${kind}`) count as emitting every variant.
  const templates = [...source.matchAll(/`([^`$]*\bastra-[a-z0-9_-]+(?:__|--))\$\{/g)].map(([, prefix]) => prefix.split(/\s+/).at(-1));
  const orphans = [...styled].filter((name) => name !== 'astra-ui' && !emitted.has(name) && !templates.some((prefix) => name.startsWith(prefix)));
  assert.deepEqual(orphans, [], 'CSS classes no component emits');
});

test('no temporary specification is included in the package workspace', async () => {
  const entries = await readdir(root);
  assert.equal(entries.includes('SPEC.md'), false);
  const packageEntries = await readdir(packageRoot);
  assert.equal(packageEntries.includes('SPEC.md'), false);
});
