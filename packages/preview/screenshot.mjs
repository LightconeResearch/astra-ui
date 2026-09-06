// Screenshot every page of the exported paper in light and dark mode at
// several widths, plus the states astra-ui contributes: the hover preview and
// the record dialog a reference opens, one per record kind. CI uploads the
// PNGs to Argos for a visual diff against the pull request's merge base.
//
//   node packages/preview/screenshot.mjs [--dir <export>] [--out <dir>] [--widths 1280,960,640]
//
// Run `npm run preview:build` first; the export is served with serve.mjs so
// the pages load exactly as they do on the static host.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  args.splice(index, 2);
  return value;
};
const dir = resolve(option('--dir', join(here, 'dist')));
const out = resolve(option('--out', join(here, 'screenshots/paper')));
const widths = option('--widths', '1280,960,640').split(',').map(Number);
if (args.length) throw new Error(`unknown arguments: ${args.join(' ')}`);
if (!existsSync(join(dir, 'index.html'))) throw new Error(`no export in ${dir}; run npm run preview:build first`);

// Every directory holding an index.html is a page; MyST writes <slug>/index.html.
const SKIP = new Set(['build', '_assets', 'gallery']);
const pages = ['/', ...readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !SKIP.has(entry.name) && existsSync(join(dir, entry.name, 'index.html')))
  .map((entry) => `/${entry.name}`)
  .sort()];

const port = 4320;
const base = `http://localhost:${port}`;
const server = serve(dir, port);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((image) => !image.complete).map(
      (image) => new Promise((done) => { image.addEventListener('load', done); image.addEventListener('error', done); }),
    ));
  });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
let count = 0;
try {
  for (const scheme of ['light', 'dark']) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: scheme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.error(`[${page.url()}] ${error.message}`));
      for (const path of pages) {
        await page.goto(base + path, { waitUntil: 'load' });
        await settle(page);
        const slug = path === '/' ? 'index' : path.slice(1).replaceAll('/', '-');
        await page.screenshot({ path: join(out, `${slug}--${scheme}--${width}.png`), fullPage: true });
        count += 1;
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
          count += 1;
          await page.mouse.move(0, 0);
        }
        // Clicking a reference opens its record in a dialog; capture one per kind.
        for (const kind of ['decision', 'finding', 'prior_insight', 'value']) {
          const opener = page.locator(`.astra-ref-trigger:has(.astra-ref--${kind})`).first();
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
          count += 1;
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${count} screenshots of ${pages.length} pages in ${out}`);
