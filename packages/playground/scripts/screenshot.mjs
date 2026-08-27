// Capture every Ladle story in light and dark brand themes.
//
//   node scripts/screenshot.mjs <outDir> [--filter substring] [--width px]
//
// Starts `ladle serve` on the configured port, reads /meta.json, and writes
// <outDir>/<storyId>--<theme>.png at a fixed 1280x900 viewport. Compare two
// runs with scripts/compare.mjs.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} needs a value`);
  args.splice(index, 2);
  return value;
};
const filter = option('--filter');
const width = Number(option('--width') ?? 1280);
const outDir = resolve(args[0] ?? join(here, '../screenshots/run'));
const port = 61000;
const base = `http://localhost:${port}`;

mkdirSync(outDir, { recursive: true });

const server = spawn('npx', ['ladle', 'serve', '--port', String(port)], {
  cwd: join(here, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/meta.json`);
      if (response.ok) return response.json();
    } catch {
      // not up yet
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('ladle did not start');
}

try {
  const meta = await waitForServer();
  const ids = Object.keys(meta.stories).filter((id) => !filter || id.includes(filter));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[${page.url()}] ${error.message}`));
  for (const id of ids) {
    for (const theme of ['light', 'dark']) {
      await page.goto(`${base}/?story=${id}&mode=preview&theme=${theme}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.evaluate(() => document.fonts.ready);
      const file = join(outDir, `${id}--${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
  }
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
