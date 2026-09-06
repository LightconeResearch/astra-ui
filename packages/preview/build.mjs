// Render the demo paper through astra-theme against THIS checkout's
// @astra-spec/ui and export it as a static site. CI runs exactly this for every
// pull request, so a local run reproduces a preview.
//
//   node packages/preview/build.mjs [options]
//
//   --ui <dir|ref>        astra-ui checkout to pack (default: this repository) or a git ref
//   --theme <dir|ref>     astra-theme checkout or git ref (default: refs.json)
//   --content <dir|ref>   MyST project checkout or git ref (default: refs.json)
//   --mystra <file|url>   MySTRA plugin bundle (default: whatever the content pins)
//   --out <dir>           output directory (default: packages/preview/dist)
//   --cache <dir>         work directory for clones, installs and tarballs (default: packages/preview/.cache)
//   --base-url <path>     BASE_URL for hosting under a subpath, e.g. /astra-ui/pr-12
//   --keep-artifacts      keep binary science artifacts (.npy, .h5, ...) in the export
//   --serve               serve the export after building
//   --port <n>            port for --serve (default 4310)
//
// PREVIEW_UI, PREVIEW_THEME, PREVIEW_CONTENT, PREVIEW_MYSTRA and PREVIEW_CACHE are
// environment fallbacks for the matching flags; the workflow sets them from its inputs.
//
// A value naming an existing directory is used as a local checkout: it is copied
// into .cache/ so the checkout itself is never modified. Anything else is fetched
// shallowly from the repository in refs.json as a branch, tag, or commit.
//
// The chain, step by step:
//   1. `npm pack` @astra-spec/ui into a tarball;
//   2. install that tarball into astra-theme's overlay package and build the
//      article template, which bundles the UI into its Remix output;
//   3. point the content's myst.yml at the built template and run
//      `myst build --html`, which crawls the theme into plain files;
//   4. fix the font paths MyST leaves unrewritten in CSS, prune artifacts the
//      browser never loads, add robots/vercel config and a manifest of what was built.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const refs = JSON.parse(readFileSync(join(here, 'refs.json'), 'utf8'));
// npm/npx are .cmd shims on Windows, which only a shell can start.
const shell = process.platform === 'win32';

// --- arguments ---------------------------------------------------------------

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  args.splice(index, 2);
  return value;
};
const flag = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
};
const options = {
  ui: option('--ui', process.env.PREVIEW_UI || root),
  theme: option('--theme', process.env.PREVIEW_THEME || refs.theme.ref),
  content: option('--content', process.env.PREVIEW_CONTENT || refs.content.ref),
  mystra: option('--mystra', process.env.PREVIEW_MYSTRA || refs.mystra || undefined),
  out: resolve(option('--out', join(here, 'dist'))),
  cache: resolve(option('--cache', process.env.PREVIEW_CACHE || join(here, '.cache'))),
  baseUrl: option('--base-url', process.env.BASE_URL || undefined),
  keepArtifacts: flag('--keep-artifacts'),
  serve: flag('--serve'),
  port: Number(option('--port', '4310')),
};
if (args.length) throw new Error(`unknown arguments: ${args.join(' ')}`);
const work = options.cache;

// --- helpers -----------------------------------------------------------------

const rel = (path) => {
  const short = relative(root, path);
  return short.startsWith('..') ? path : short || '.';
};
const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();
const isFile = (path) => existsSync(path) && statSync(path).isFile();

function log(message) {
  console.log(`\n▶ ${message}`);
}

function run(command, argv, { cwd = root, env = {}, capture = false } = {}) {
  const result = spawnSync(command, argv, {
    cwd,
    env: { ...process.env, ...env },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`\`${command} ${argv.join(' ')}\` failed in ${rel(cwd)} (exit ${result.status ?? result.signal})`);
  }
  return result.stdout ?? '';
}

function git(cwd, ...argv) {
  return run('git', argv, { cwd, capture: true }).trim();
}

function describe(dir) {
  try {
    const sha = git(dir, 'rev-parse', '--short', 'HEAD');
    return git(dir, 'status', '--porcelain') ? `${sha}-dirty` : sha;
  } catch {
    return 'unversioned';
  }
}

// Entries never copied from a local checkout into the work copy.
const SKIP = new Set(['node_modules', '.git', '_build', '.cache', 'build', 'dist']);

// Materialise a source under .cache/<name>. A local checkout is copied, a ref is
// fetched shallowly. node_modules and MyST's _build cache in the work copy
// survive across runs so repeated local builds skip the slow parts.
function materialize(name, source, repository) {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  if (isDirectory(source)) {
    const from = resolve(source);
    log(`${name}: copying ${from}`);
    for (const entry of readdirSync(dir)) {
      if (entry !== 'node_modules' && entry !== '_build') rmSync(join(dir, entry), { recursive: true, force: true });
    }
    cpSync(from, dir, { recursive: true, filter: (path) => path === from || !SKIP.has(basename(path)) });
    return { dir, label: `${rel(from)} (${describe(from)})` };
  }
  log(`${name}: fetching ${source} from ${repository}`);
  if (!existsSync(join(dir, '.git'))) run('git', ['init', '-q'], { cwd: dir });
  run('git', ['fetch', '-q', '--depth', '1', repository, source], { cwd: dir });
  run('git', ['checkout', '-q', '--force', '--detach', 'FETCH_HEAD'], { cwd: dir });
  run('git', ['clean', '-fdxq', '-e', 'node_modules', '-e', '_build'], { cwd: dir });
  const sha = git(dir, 'rev-parse', '--short', 'HEAD');
  return { dir, label: source.startsWith(sha) ? sha : `${source} (${sha})` };
}

// `npm ci` only when the committed lockfile changed since the last install.
function ensureInstalled(dir) {
  const hash = createHash('sha256').update(readFileSync(join(dir, 'package-lock.json'))).digest('hex');
  const marker = join(dir, 'node_modules', '.preview-lock');
  if (existsSync(marker) && readFileSync(marker, 'utf8') === hash) {
    console.log(`  dependencies already installed in ${rel(dir)}`);
    return;
  }
  log(`${rel(dir)}: npm ci`);
  run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir });
  writeFileSync(marker, hash);
}

// --- 1. pack @astra-spec/ui ---------------------------------------------------

function packUi() {
  let dir;
  let label;
  if (isDirectory(options.ui)) {
    dir = resolve(options.ui);
    label = describe(dir);
    if (!existsSync(join(dir, 'node_modules'))) ensureInstalled(dir);
  } else {
    ({ dir, label } = materialize('ui', options.ui, refs.ui.repository));
    ensureInstalled(dir);
  }
  log(`ui: npm pack @astra-spec/ui from ${rel(dir)}`);
  for (const stale of readdirSync(work)) {
    if (stale.startsWith('astra-spec-ui-') && stale.endsWith('.tgz')) rmSync(join(work, stale));
  }
  const output = run('npm', ['pack', '--workspace', '@astra-spec/ui', '--pack-destination', work, '--json'], { cwd: dir, capture: true });
  const parsed = JSON.parse(output);
  const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  const tarball = join(work, entry.filename);
  if (!existsSync(tarball)) throw new Error(`npm pack did not produce ${tarball}`);
  return { dir, tarball, label: `${entry.version} from ${label}` };
}

// --- 2. build astra-theme against it ------------------------------------------

function buildTheme(tarball) {
  const theme = materialize('theme', options.theme, refs.theme.repository);
  ensureInstalled(theme.dir);
  log('theme: installing the packed @astra-spec/ui into packages/astra');
  run('npm', ['install', tarball, '--workspace', 'packages/astra', '--no-audit', '--no-fund'], { cwd: theme.dir });
  const script = `build:${basename(refs.theme.template)}`;
  log(`theme: npm run ${script}`);
  try {
    run('npm', ['run', script], { cwd: theme.dir });
  } catch (error) {
    throw new Error(
      `${error.message}\nThe theme at ${theme.label} does not build against this @astra-spec/ui. ` +
      'If the package API changed, point --theme (or the workflow\'s "theme" input) at a compatible astra-theme branch.',
    );
  }
  const template = join(theme.dir, refs.theme.template);
  for (const required of ['template.yml', 'build', 'public']) {
    if (!existsSync(join(template, required))) throw new Error(`theme build left no ${required} in ${rel(template)}`);
  }
  // myst installs a template's dependencies unless node_modules already exists
  // beside template.yml; the built theme needs nothing, its deps are hoisted.
  mkdirSync(join(template, 'node_modules'), { recursive: true });
  return { ...theme, template };
}

// --- 3. export the MyST project -----------------------------------------------

function mystBinary() {
  const manifest = createRequire(import.meta.url).resolve('mystmd/package.json');
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
  return join(dirname(manifest), typeof bin === 'string' ? bin : bin.myst);
}

function exportSite(theme) {
  const content = materialize('content', options.content, refs.content.repository);
  const configPath = join(content.dir, 'myst.yml');
  if (!isFile(configPath)) throw new Error(`no myst.yml in ${rel(content.dir)}`);
  const config = parseDocument(readFileSync(configPath, 'utf8'));
  config.setIn(['site', 'template'], theme.template);
  const plugins = config.getIn(['project', 'plugins']);
  const isMystra = (item) => typeof item?.value === 'string' && item.value.includes('mystra');
  let mystra = plugins?.items?.find(isMystra)?.value ?? 'none';
  if (options.mystra) {
    mystra = isFile(options.mystra) ? resolve(options.mystra) : options.mystra;
    const node = config.createNode(mystra);
    if (plugins?.items?.some(isMystra)) plugins.items = plugins.items.map((item) => (isMystra(item) ? node : item));
    else config.addIn(['project', 'plugins'], node);
  }
  writeFileSync(configPath, config.toString());
  // Keep _build/cache (DOI lookups, plugin download) but drop the rendered site:
  // MyST only ever adds to _build/site/public, so a reused work copy would
  // otherwise export artifacts left over from a previous content revision.
  for (const stale of ['_build/html', '_build/site', '_build/templates']) {
    rmSync(join(content.dir, stale), { recursive: true, force: true });
  }
  log(`content: myst build --html${options.baseUrl ? ` (BASE_URL=${options.baseUrl})` : ''}`);
  run(process.execPath, [mystBinary(), 'build', '--html'], {
    cwd: content.dir,
    env: options.baseUrl ? { BASE_URL: options.baseUrl } : {},
  });
  const html = join(content.dir, '_build/html');
  if (!isFile(join(html, 'index.html'))) throw new Error(`myst build --html produced no index.html in ${rel(html)}`);
  return { ...content, html, mystra };
}

// --- 4. finalize ----------------------------------------------------------------

// Binary science artifacts that MyST copies alongside the bindings; the browser
// never loads them and they dominate the export size.
const ARTIFACT_EXTENSIONS = new Set([
  '.npy', '.npz', '.h5', '.hdf5', '.fits', '.parquet', '.pkl', '.pickle', '.nc', '.zarr', '.feather', '.arrow', '.mat',
]);

function prune(dir) {
  let count = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !ARTIFACT_EXTENSIONS.has(extname(entry.name))) continue;
    const file = join(entry.parentPath ?? entry.path, entry.name);
    bytes += statSync(file).size;
    rmSync(file);
    count += 1;
  }
  if (count) console.log(`  pruned ${count} artifact files (${(bytes / 1e6).toFixed(1)} MB); pass --keep-artifacts to keep them`);
}

// `myst build --html` rewrites the theme's /myst_assets_folder/ public path to
// <BASE_URL>/build/ in html, js and json, but not in the CSS bundles, whose
// font urls then 404 on a static host. Apply the same rewrite to the CSS.
function rewriteAssetPaths(dir) {
  const prefix = `${options.baseUrl ?? ''}/build/`;
  let count = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.css') continue;
    const file = join(entry.parentPath ?? entry.path, entry.name);
    const css = readFileSync(file, 'utf8');
    if (!css.includes('/myst_assets_folder/')) continue;
    writeFileSync(file, css.replaceAll('/myst_assets_folder/', prefix));
    count += 1;
  }
  if (count) console.log(`  rewrote /myst_assets_folder/ to ${prefix} in ${count} stylesheets`);
}

function finalize({ ui, theme, content }) {
  log(`writing ${rel(options.out)}`);
  rmSync(options.out, { recursive: true, force: true });
  cpSync(content.html, options.out, { recursive: true });
  rewriteAssetPaths(options.out);
  if (!options.keepArtifacts) prune(options.out);
  // Previews must never be indexed as a copy of the real publication.
  writeFileSync(join(options.out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(options.out, 'vercel.json'), `${JSON.stringify({
    trailingSlash: false,
    headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }],
  }, null, 2)}\n`);
  const manifest = {
    builtAt: new Date().toISOString(),
    ui: ui.label,
    theme: theme.label,
    content: content.label,
    mystra: content.mystra,
    summary: `@astra-spec/ui ${ui.label} · astra-theme ${theme.label} · content ${content.label} · MySTRA ${content.mystra}`,
  };
  writeFileSync(join(options.out, '_preview.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// --- main -----------------------------------------------------------------------

const started = Date.now();
mkdirSync(work, { recursive: true });
const ui = packUi();
const theme = buildTheme(ui.tarball);
const content = exportSite(theme);
const manifest = finalize({ ui, theme, content });
console.log(`\n✔ ${manifest.summary}`);
console.log(`✔ static site in ${rel(options.out)} after ${Math.round((Date.now() - started) / 1000)} s`);
if (options.serve) serve(options.out, options.port);
