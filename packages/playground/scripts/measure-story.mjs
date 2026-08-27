import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const port = 61000; const base = `http://localhost:${port}`;
const server = spawn('npx', ['ladle', 'serve', '--port', String(port)], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
async function up() { for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/meta.json`); if (r.ok) return; } catch {} await new Promise(d => setTimeout(d, 500)); } throw new Error('no server'); }
const [story, ...selectors] = process.argv.slice(2);
try {
  await up();
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/?story=${story}&mode=preview&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const info = await page.evaluate((selectors) => selectors.map((s) => {
    const el = document.querySelector(s); if (!el) return [s, 'MISSING'];
    const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    return [s, { rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], fontSize: cs.fontSize, fontFamily: cs.fontFamily.slice(0, 20), lineHeight: cs.lineHeight, padding: cs.padding, margin: cs.margin, boxSizing: cs.boxSizing, maxHeight: cs.maxHeight, height: cs.height, width: cs.width, display: cs.display }];
  }), selectors);
  for (const [s, v] of info) console.log(s, JSON.stringify(v));
  await browser.close();
} finally { server.kill('SIGTERM'); }
