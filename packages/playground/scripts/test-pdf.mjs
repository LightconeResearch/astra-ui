// Browser smoke test against the built playground and its real PDF.js worker.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:61002';
const server = spawn('npx', ['ladle', 'preview', '--port', '61002', '--host', '127.0.0.1'], {
  cwd: new URL('..', import.meta.url), stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32',
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));
let browser;
const output = new URL('../../../.cache/pdf-browser/', import.meta.url);
const quote = 'A reproducible result appears on the final page.';
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'The built playground starts');
  await mkdir(output, { recursive: true });
  browser = await chromium.launch();
  for (const width of [1280, 640]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    const workers = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('worker', (worker) => workers.push(worker));
    await page.goto(`${base}/?story=papers--reader&mode=preview&theme=${width === 640 ? 'dark' : 'light'}`);
    await page.getByRole('status').filter({ hasText: '3 pages' }).waitFor();
    const locate = page.getByRole('button', { name: 'Locate source passage 1 in paper' });
    await locate.click();
    const mark = page.locator('[data-page="3"] mark');
    await mark.waitFor();
    assert.equal(await mark.textContent(), quote);
    assert.equal(await page.getByRole('status').textContent(), 'Quote highlighted on page 3 of 3');
    assert.equal(workers.length, 1, 'A real worker is created for the document');
    const visible = () => mark.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const scroll = node.closest('.astra-paper-pdf__scroll').getBoundingClientRect();
      return bounds.top >= scroll.top && bounds.bottom <= scroll.bottom;
    });
    assert.ok(await visible(), 'The located passage is visible');
    const canvas = page.locator('[data-page="3"] canvas');
    const before = await canvas.evaluate((node) => node.width);
    await page.getByRole('button', { name: 'Zoom PDF in' }).click();
    await page.waitForFunction((oldWidth) => document.querySelector('[data-page="3"] canvas').width > oldWidth, before);
    await mark.waitFor();
    assert.ok(await visible(), 'Zoom preserves the visible passage');
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
    await page.screenshot({ path: new URL(`reader-${width}.png`, output).pathname });
    const terminated = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('The document worker was not released')); }, 10_000);
      workers[0].once('close', () => { clearTimeout(timeout); resolve(); });
    });
    await page.getByRole('button', { name: 'Close paper details' }).click();
    await terminated;
    assert.equal(await page.locator('[data-slot="paper-pdf-viewer"]').count(), 0);
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log(`PDF reading, highlighting, zoom, repeated locate and worker disposal passed at ${width}px.`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
