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
  assert.match(css, /--astra-accent:\s*#a67c3c/i);
  assert.match(css, /--astra-kicker:\s*#3f7280/i);
  assert.match(css, /--astra-paper:\s*#221f20/i);
  assert.match(css, /--astra-accent:\s*#c2924a/i);
  assert.match(css, /--astra-heading:\s*"Quattrocento"/);
  assert.match(css, /--astra-serif:\s*"Newsreader"/);
  assert.match(css, /--astra-label:\s*"Alegreya"/);
  assert.match(css, /--astra-mono:\s*"JetBrains Mono"/);
  assert.doesNotMatch(css, /@import\s+url|https?:\/\//i);
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
