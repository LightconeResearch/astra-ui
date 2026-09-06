// Capture every Ladle story in light and dark brand themes.
//
//   node scripts/screenshot.mjs <outDir> [--filter substring] [--width px]
//
// Builds the playground once with `ladle build` (into build/, gitignored),
// serves that static output, reads its meta.json, and writes
// <outDir>/<storyId>--<theme>.png at a fixed 1280x900 viewport. A static build
// loads each story in milliseconds, where the dev server would re-bundle on a
// cold CI runner. The Preview workflow uploads a run to Argos for a visual
// diff against the merge base.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../../preview/serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const playground = join(here, '..');
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
const outDir = resolve(args[0] ?? join(playground, 'screenshots/run'));
const buildDir = join(playground, 'build');
const port = 61000;
const base = `http://localhost:${port}`;

mkdirSync(outDir, { recursive: true });

// Ladle resolves --outDir against its working directory, so keep it relative.
const build = spawnSync('npx', ['ladle', 'build', '--outDir', 'build'], {
  cwd: playground,
  stdio: 'inherit',
  // npx is a .cmd shim on Windows, which only a shell can start.
  shell: process.platform === 'win32',
});
if (build.status !== 0 || !existsSync(join(buildDir, 'meta.json'))) throw new Error('ladle build failed');

const meta = JSON.parse(readFileSync(join(buildDir, 'meta.json'), 'utf8'));
const ids = Object.keys(meta.stories).filter((id) => !filter || id.includes(filter));
const server = serve(buildDir, port);
try {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[${page.url()}] ${error.message}`));
  for (const id of ids) {
    for (const theme of ['light', 'dark']) {
      await page.goto(`${base}/?story=${id}&mode=preview&theme=${theme}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const file = join(outDir, `${id}--${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
  }
  await browser.close();
} finally {
  server.close();
}
