// Browser smoke test against the built playground and its real PDF.js worker.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:61002';
const output = new URL('../../../.cache/pdf-browser/', import.meta.url);
const quote = 'A reproducible result appears on the final page.';

const server = spawn('npx', ['ladle', 'preview', '--port', '61002', '--host', '127.0.0.1'], {
  cwd: new URL('..', import.meta.url), stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32',
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

const passageVisible = (mark) => mark.evaluate((node) => {
  const bounds = node.getBoundingClientRect();
  const scroll = node.closest('.astra-paper-pdf__scroll').getBoundingClientRect();
  return bounds.top >= scroll.top && bounds.bottom <= scroll.bottom;
});

/** Reading, locating, zooming, a repeated locate, and worker disposal in one reader story. */
async function checkReader(browser, { story, width, theme }) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  // Exercise the exact missing API on older supported browsers in both realms.
  await page.addInitScript(() => { Reflect.deleteProperty(Promise, 'withResolvers'); });
  await page.route(/pdf\.worker.*\.mjs$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `delete Promise.withResolvers;
      globalThis.astraMissingPromiseResolvers = typeof Promise.withResolvers === 'undefined';
      ${await response.text()}` });
  });
  const errors = [];
  const workers = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('worker', (worker) => workers.push(worker));
  await page.goto(`${base}/?story=${story}&mode=preview&theme=${theme}`);
  await page.getByRole('status').filter({ hasText: '3 pages' }).waitFor();
  const locate = page.getByRole('button', { name: 'Locate source passage 1 in paper' });
  await locate.click();
  const mark = page.locator('[data-page="3"] mark');
  await mark.waitFor();
  assert.equal(await mark.textContent(), quote);
  assert.equal(await page.getByRole('status').textContent(), 'Quote highlighted on page 3 of 3');
  assert.equal(workers.length, 1, 'One real worker is created for the document');
  assert.equal(await workers[0].evaluate(() => globalThis.astraMissingPromiseResolvers), true, 'The worker initialized without native Promise.withResolvers');
  assert.ok(await passageVisible(mark), 'The located passage is visible');
  assert.equal(await page.evaluate(() => {
    const canvas = document.querySelector('body > canvas.hiddenCanvasElement');
    return canvas && getComputedStyle(canvas).display;
  }), 'none', 'The measuring canvas PDF.js appends to <body> is hidden');
  const canvas = page.locator('[data-page="3"] canvas');
  const before = await canvas.evaluate((node) => node.width);
  await page.getByRole('button', { name: 'Zoom PDF in' }).click();
  await page.waitForFunction((oldWidth) => document.querySelector('[data-page="3"] canvas').width > oldWidth, before);
  await mark.waitFor();
  assert.ok(await passageVisible(mark), 'Zoom preserves the visible passage');
  // A repeated locate must scroll back even though the quote is unchanged.
  await page.locator('.astra-paper-pdf__scroll').evaluate((node) => { node.scrollTop = 0; });
  await locate.click();
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-page="3"] mark');
    if (!node) return false;
    const bounds = node.getBoundingClientRect();
    const scroll = node.closest('.astra-paper-pdf__scroll').getBoundingClientRect();
    return bounds.top >= scroll.top && bounds.bottom <= scroll.bottom;
  });
  await page.screenshot({ path: new URL(`${story}-${width}.png`, output).pathname });
  const terminated = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { reject(new Error('The document worker was not released')); }, 10_000);
    workers[0].once('close', () => { clearTimeout(timeout); resolve(); });
  });
  await page.getByRole('button', { name: 'Close paper details' }).click();
  await terminated;
  assert.equal(await page.locator('[data-slot="paper-pdf-viewer"]').count(), 0);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(`${story}: reading, highlighting, zoom, repeated locate and worker disposal passed at ${width}px.`);
  await page.close();
}

async function checkRotation(browser, rotation) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?story=papers--rotated${rotation}&mode=preview`);
  const mark = page.locator('[data-page="3"] mark');
  await mark.waitFor();
  assert.equal(await mark.textContent(), quote);
  // The rotated fixtures paint a magenta reference behind the quote; the DOM highlight must cover it.
  const aligned = () => mark.evaluate((node) => {
    const canvas = node.closest('[data-page]').querySelector('canvas');
    const bounds = canvas.getBoundingClientRect();
    const highlight = node.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    const x = Math.round((highlight.left - bounds.left) * scaleX);
    const y = Math.round((highlight.top - bounds.top) * scaleY);
    const width = Math.round(highlight.width * scaleX);
    const height = Math.round(highlight.height * scaleY);
    if (width <= 0 || height <= 0) return false;
    const pixels = canvas.getContext('2d').getImageData(x, y, width, height).data;
    let referencePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 200 && pixels[index + 1] < 80 && pixels[index + 2] > 200) referencePixels++;
    }
    return referencePixels / (width * height) > 0.5;
  });
  assert.ok(await aligned(), `The ${rotation} degree highlight overlaps the quote's canvas reference`);
  const before = await page.locator('[data-page="3"] canvas').evaluate((node) => node.width);
  await page.getByRole('button', { name: 'Zoom PDF in' }).click();
  await page.waitForFunction((oldWidth) => document.querySelector('[data-page="3"] canvas').width > oldWidth, before);
  await mark.waitFor();
  assert.ok(await aligned(), `The ${rotation} degree highlight stays aligned after zoom`);
  await page.screenshot({ path: new URL(`rotation-${rotation}.png`, output).pathname });
  assert.deepEqual(errors, []);
  console.log(`Rotated PDF highlight alignment passed at ${rotation} degrees.`);
  await page.close();
}

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'The built playground starts');
  await mkdir(output, { recursive: true });
  browser = await chromium.launch();
  await checkReader(browser, { story: 'papers--reader', width: 1280, theme: 'light' });
  await checkReader(browser, { story: 'papers--reader', width: 640, theme: 'dark' });
  await checkReader(browser, { story: 'papers--reader-with-worker', width: 1280, theme: 'light' });
  for (const rotation of [90, 180, 270]) await checkRotation(browser, rotation);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
