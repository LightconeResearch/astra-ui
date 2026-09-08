// Screenshot the surfaces a pull request can change, for Argos to diff against
// the merge base:
//
//   node packages/preview/screenshot.mjs paper   [--dir <export>] [--out <dir>] [--widths 1280,960,640]
//   node packages/preview/screenshot.mjs stories [--out <dir>] [--filter <substring>] [--width <px>]
//
// `paper` captures every page of the exported demo paper (run
// `npm run preview:build` first) in light and dark mode at each width, plus the
// hover preview and the record dialog each reference kind opens.
// `stories` builds the playground once with `ladle build` (into
// packages/playground/build, gitignored), serves that static output and captures
// every story in both themes at one width; the playground covers what the paper
// never mounts (inventory blocks, embedded detail, primitives, tokens). Both
// serve their files with serve.mjs, so pages load as they do on the static host.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { checkBrand } from './check-brand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const playground = resolve(here, '../playground');
const args = process.argv.slice(2);
const mode = args.shift();
if (mode !== 'paper' && mode !== 'stories') throw new Error('usage: screenshot.mjs paper|stories [options]');
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  args.splice(index, 2);
  return value;
};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((image) => !image.complete).map(
      (image) => new Promise((done) => { image.addEventListener('load', done); image.addEventListener('error', done); }),
    ));
  });
  await page.waitForTimeout(400);
  await checkBrand(page);
}

function resetDirectory(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

async function withBrowser(dir, port, capture) {
  const server = serve(dir, port);
  const browser = await chromium.launch();
  try {
    return await capture(browser, `http://localhost:${port}`);
  } finally {
    await browser.close();
    server.close();
  }
}

function newPage(context) {
  const page = context.newPage();
  return page.then((opened) => {
    opened.on('pageerror', (error) => console.error(`[${opened.url()}] ${error.message}`));
    return opened;
  });
}

// --- paper ----------------------------------------------------------------------

async function capturePaper() {
  const dir = resolve(option('--dir', join(here, 'dist')));
  const out = resolve(option('--out', join(here, 'screenshots/paper')));
  const widths = option('--widths', '1280,960,640').split(',').map(Number);
  if (args.length) throw new Error(`unknown arguments: ${args.join(' ')}`);
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`no export in ${dir}; run npm run preview:build first`);

  // Every directory holding an index.html is a page; MyST writes <slug>/index.html.
  const SKIP = new Set(['build', '_assets', 'gallery', 'playground']);
  const pages = ['/', ...readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP.has(entry.name) && existsSync(join(dir, entry.name, 'index.html')))
    .map((entry) => `/${entry.name}`)
    .sort()];
  resetDirectory(out);

  const count = await withBrowser(dir, 4320, async (browser, base) => {
    let taken = 0;
    for (const scheme of ['light', 'dark']) {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: 1,
          colorScheme: scheme,
          reducedMotion: 'reduce',
        });
        const page = await newPage(context);
        for (const path of pages) {
          await page.goto(base + path, { waitUntil: 'load' });
          await settle(page);
          const slug = path === '/' ? 'index' : path.slice(1).replaceAll('/', '-');
          await page.screenshot({ path: join(out, `${slug}--${scheme}--${width}.png`), fullPage: true });
          taken += 1;
        }
        // The hover preview and the record dialogs, once per scheme at the widest viewport.
        if (width === widths[0]) {
          await page.goto(base + '/', { waitUntil: 'load' });
          await settle(page);
          const trigger = page.locator('.astra-ref-trigger').first();
          if (await trigger.count()) {
            await trigger.scrollIntoViewIfNeeded();
            await trigger.hover();
            // `.astra-ui` is only the scoping wrapper; the popover surface is what must be on screen.
            await page.locator('.astra-preview-popover').first().waitFor({ timeout: 5000 }).catch(() => console.warn('no hover preview appeared'));
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(out, `index--hover--${scheme}--${width}.png`) });
            taken += 1;
            await page.mouse.move(0, 0);
          }
          // Clicking a reference opens its record in a dialog; capture one per kind.
          for (const kind of ['input', 'decision', 'finding', 'prior_insight', 'output', 'value']) {
            const opener = page.locator(`.astra-ref-trigger.astra-ref--${kind}, .astra-ref-trigger:has(.astra-ref--${kind})`).first();
            if (!(await opener.count())) continue;
            await opener.scrollIntoViewIfNeeded();
            await opener.click();
            const dialog = page.locator('dialog[open]').first();
            if (!(await dialog.waitFor({ timeout: 5000 }).then(() => true, () => false))) {
              console.warn(`no dialog opened from the first ${kind} reference`);
              continue;
            }
            await settle(page);
            await page.screenshot({ path: join(out, `index--dialog-${kind}--${scheme}--${width}.png`) });
            taken += 1;
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          }
        }
        await context.close();
      }
    }
    return taken;
  });
  console.log(`${count} screenshots of ${pages.length} pages in ${out}`);
}

// --- stories --------------------------------------------------------------------

async function captureStories() {
  const dir = option('--dir', undefined);
  const out = resolve(option('--out', join(here, 'screenshots/stories')));
  const filter = option('--filter', undefined);
  const width = Number(option('--width', '1280'));
  if (args.length) throw new Error(`unknown arguments: ${args.join(' ')}`);

  // Ladle resolves --outDir against its working directory, so keep it relative.
  const build = dir ? { status: 0 } : spawnSync('npx', ['ladle', 'build', '--outDir', 'build'], {
    cwd: playground,
    stdio: 'inherit',
    // npx is a .cmd shim on Windows, which only a shell can start.
    shell: process.platform === 'win32',
  });
  const buildDir = dir ? resolve(dir) : join(playground, 'build');
  if (build.status !== 0 || !existsSync(join(buildDir, 'meta.json'))) throw new Error('ladle build failed');
  const meta = JSON.parse(readFileSync(join(buildDir, 'meta.json'), 'utf8'));
  const ids = Object.keys(meta.stories).filter((id) => !filter || id.includes(filter));
  resetDirectory(out);

  const count = await withBrowser(buildDir, 4321, async (browser, base) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await newPage(context);
    let taken = 0;
    for (const id of ids) {
      for (const theme of ['light', 'dark']) {
        await page.goto(`${base}/?story=${id}&mode=preview&theme=${theme}`, { waitUntil: 'load' });
        await page.locator('.playground-root').waitFor();
        if (id.startsWith('papers--')) await page.locator('.astra-paper-pdf__page canvas').first().waitFor();
        await settle(page);
        await page.screenshot({ path: join(out, `${id}--${theme}.png`), fullPage: true });
        taken += 1;
      }
    }
    return taken;
  });
  console.log(`${count} screenshots of ${ids.length} stories in ${out}`);
}

await (mode === 'paper' ? capturePaper() : captureStories());
