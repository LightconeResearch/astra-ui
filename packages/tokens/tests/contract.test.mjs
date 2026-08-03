import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageUrl = new URL('../package.json', import.meta.url);
const brandUrl = new URL('../brand.css', import.meta.url);
const themeUrl = new URL('../theme.css', import.meta.url);

test('publishes stable brand and host-aware CSS entry points', async () => {
  const manifest = JSON.parse(await readFile(packageUrl, 'utf8'));
  assert.equal(manifest.exports['./brand.css'], './brand.css');
  assert.equal(manifest.exports['./theme.css'], './theme.css');
  assert.ok(manifest.files.includes('brand.css'));
  assert.ok(manifest.files.includes('theme.css'));
});

test('preserves the canonical ASTRA palette and offline font fallbacks', async () => {
  const css = await readFile(brandUrl, 'utf8');
  assert.match(css, /--astra-canvas:\s*#e9e7e2/i);
  assert.match(css, /--astra-panel:\s*#fffdfa/i);
  assert.match(css, /--astra-raised:\s*#ffffff/i);
  assert.match(css, /--astra-action:\s*#3563a8/i);
  assert.match(css, /--astra-c-decision:\s*#b07818/i);
  assert.match(css, /--astra-c-decision-ink:\s*#7a5410/i);
  assert.match(css, /--astra-artifact-ink:\s*#1e1c19/i);
  assert.match(css, /--astra-c-output:\s*#2e7d5b/i);
  assert.match(css, /--astra-c-finding:\s*#7a4fae/i);
  assert.match(css, /--astra-c-insight:\s*#8c72a8/i);
  assert.match(css, /--astra-c-insight-ink:\s*#6f4a91/i);
  assert.match(css, /--astra-canvas:\s*#171614/i);
  assert.match(css, /--astra-heading:\s*"IBM Plex Sans"/);
  assert.match(css, /--astra-serif:\s*"IBM Plex Sans"/);
  assert.match(css, /--astra-label:\s*"IBM Plex Sans"/);
  assert.match(css, /--astra-mono:\s*"IBM Plex Mono"/);
  assert.doesNotMatch(css, /@import\s+url|https?:\/\//i);
});

test('keeps host surfaces native without remapping ASTRA record kinds', async () => {
  const css = await readFile(themeUrl, 'utf8');
  assert.match(css, /--astra-panel:\s*var\(--jp-layout-color1/);
  assert.match(css, /--astra-action:\s*var\(--jp-brand-color1/);
  assert.match(css, /--astra-focus:\s*var\(--jp-brand-color1/);
  assert.match(css, /--astra-c-input:\s*#3563a8/i);
  assert.match(css, /--astra-c-output:\s*#2e7d5b/i);
  assert.match(css, /--astra-c-decision:\s*#b07818/i);
  assert.match(css, /--astra-c-decision-ink:\s*#7a5410/i);
  assert.match(css, /\[data-jp-theme-light="false"\]/);
  assert.match(css, /\.vscode-dark/);
  assert.match(css, /--astra-c-input:\s*#8eb4ed/i);
  assert.match(css, /--astra-color-canvas:\s*var\(--astra-canvas\)/);
  assert.match(css, /--astra-radius-panel:\s*10px/);
  assert.doesNotMatch(css, /--astra-c-decision:\s*var\(--astra-accent/);
});

test('keeps all selectors scoped and contains no component styling', async () => {
  const [brand, theme] = await Promise.all([
    readFile(brandUrl, 'utf8'),
    readFile(themeUrl, 'utf8'),
  ]);
  const css = `${brand}\n${theme}`;
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /(^|[,{])\s*:root\b/m);
  assert.doesNotMatch(rules, /(^|[,{])\s*(html|body)\b/m);
  assert.doesNotMatch(rules, /\.astra-(inventory|record|result|artifact|graph|badge)\b/);
  assert.match(theme, /--jp-layout-color1/);
  assert.match(theme, /--vscode-editor-background/);
});
