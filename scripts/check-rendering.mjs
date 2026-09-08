/** Browser contract for the shared UI under the three actual integration stylesheets.
 * Run after build, with coordinated sibling checkouts and dependencies installed:
 *   node scripts/check-rendering.mjs [directory-containing-the-four-sibling-repos]
 * Uses a representative host reset, plus each host's real CSS. This complements
 * (does not replace) full application interaction tests.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { indexAnalysis } from '@astra-spec/sdk';
import { fixtureDocument as document } from '../tests/fixture.mjs';
import { RecordPreview, RecordDialog } from '../packages/react/dist/components/index.js';
import { InlineReference, KindGlyph, DialogProvider } from '../packages/react/dist/primitives/index.js';
import { Inventory } from '../packages/react/dist/views/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siblings = resolve(process.argv[2] ?? join(root, '..'));
const output = resolve(root, 'rendering-artifacts');
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'astra-rendering-'));
const h = React.createElement;
const index = indexAnalysis(document);
const records = [...index.recordByPath.values()];
const kinds = ['input', 'decision', 'finding', 'prior_insight', 'output'];
const entries = kinds.map(kind => ({ kind: 'record', record: records.find(record => record.kind === kind), analysis: document.analysis }));
entries.push({ kind: 'value', record: records.find(record => record.kind === 'output'), analysis: document.analysis, value: '0.42', unit: 'Mpc', product: 'Headline result', selection: 'bin = 1' });
const content = renderToStaticMarkup(h(React.Fragment, {},
  h('p', { id: 'inline', style: { font: '17px/1.72 var(--lc-font-body)' } }, 'Compare ',
    ...['analysis', ...kinds, 'paper'].map(kind => h(InlineReference, { kind, key: kind }, kind)),
    h(InlineReference, { kind: 'value' }, '0.42')),
  h('div', { id: 'previews', style: { display: 'grid', gridTemplateColumns: 'repeat(2, 440px)', gap: 24 } },
    ...entries.map(entry => h('div', { key: `${entry.kind}-${entry.record.kind}`, className: 'astra-preview-popover__surface', 'data-kind': entry.kind === 'value' ? 'value' : entry.record.kind },
      h(RecordPreview, { entry, document, index, onOpenRecord() {} })))),
  h('div', { id: 'glyph-contexts', 'data-kind': 'value', style: { color: 'purple', font: 'italic 9px/2 sans-serif' } },
    ...['analysis', ...kinds, 'paper'].map(kind => h(KindGlyph, { kind, key: kind }))),
  h('div', { id: 'inventory' }, h(Inventory, { document, index })),
  h('div', { id: 'details' }, h(DialogProvider, { mode: 'embedded' },
    ...entries.filter(entry => entry.kind === 'record').map(entry => h(RecordDialog, { key: entry.record.kind,
      entry: { kind: 'record', canonicalPath: entry.record.canonicalPath, analysisPath: '$' }, document, index, onClose() {}, onOpenRecord() {} })))),
));
const styles = {
  shared: [],
  article: [join(siblings, 'astra-theme/packages/astra/styles/astra.css')],
  jupyter: [join(siblings, 'jupyterlab-lightcone/style/base.css')],
  vscode: [join(siblings, 'vscode-astra/src/webview/webview.css')],
};
const reset = `body { margin:0; } article p, article li { font-size: 23px; line-height: 2; }
.jp-ThemedContainer button, .jp-ThemedContainer code { font-family: sans-serif; font-size: 21px; border-radius: 2px; }
body.vscode-dark { font-family: sans-serif; font-size: 13px; } a { color: purple; } code { background: pink; }`;
for (const [name, sheets] of Object.entries(styles)) {
  const css = [join(siblings, 'brand/adapters/astra.css'), join(root, 'packages/react/styles.css'), join(root, 'packages/react/isolate.css'), ...sheets].map(path => `@import ${JSON.stringify(path)};`).join('\n');
  await build({ stdin: { contents: css, loader: 'css', resolveDir: root }, bundle: true, outfile: join(temp, `${name}.css`), loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl' }, logLevel: 'silent' });
  await writeFile(join(temp, `${name}.html`), `<!doctype html><html class="lightcone-brand"><head><meta charset="utf-8"><style>${reset}</style><link rel="stylesheet" href="/${name}.css"></head><body class="jp-ThemedContainer vscode-dark"><article><p id="brand-prose" style="color:var(--astra-color-text);background:var(--astra-color-canvas)">Branded article prose</p><div id="root" class="astra-ui lightcone-brand astra-isolate ${name === 'jupyter' ? 'jp-jupyterlab-lightcone-InventoryPanel' : ''}" style="padding:24px">${content}</div></article></body></html>`);
}
const server = createServer(async (request, response) => {
  try { const path = join(temp, request.url === '/' ? 'shared.html' : request.url.slice(1)); response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/html'); response.end(await readFile(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const address = `http://127.0.0.1:${server.address().port}`;
const results = {};
try {
  for (const scheme of ['light', 'dark']) {
    for (const rootSize of [16, 20]) {
      let expected;
      for (const name of Object.keys(styles)) {
        await page.goto(`${address}/${name}.html`);
        await page.evaluate(({ scheme, rootSize }) => {
          document.documentElement.style.fontSize = `${rootSize}px`;
          document.documentElement.classList.toggle('dark', scheme === 'dark');
          for (const node of document.querySelectorAll('.lightcone-brand')) {
            node.dataset.lightconeColorScheme = scheme; node.dataset.astraColorScheme = scheme;
          }
        }, { scheme, rootSize });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => [...document.fonts].some(face => face.family.includes('Lightcone Brand Newsreader') && face.style === 'italic' && face.status === 'loaded')), true, 'bundled italic font must load');
        const metrics = await page.evaluate(() => {
          const selectors = ['#inline .astra-inline-reference', '#inline .astra-kind-glyph', '.astra-record-preview__header .astra-surface-header__title', '.astra-record-preview__header .astra-surface-header__eyebrow', '.astra-record-preview__relation-trigger', '.astra-record-preview__relation-glyph', '.astra-record-preview__quote', '.astra-record-preview[data-value-product] .astra-record-preview__selection > span:last-child', '.astra-record-preview__source', '.astra-record-preview[data-entry-kind="value"] .astra-surface-header__eyebrow', '.astra-record-list__name strong', '.astra-record-list__glyph', '.astra-relation-item__label', '.astra-relation-item__glyph .astra-kind-glyph', '#details .astra-surface-header__title', '#details .astra-dialog__actions button'];
          return Object.fromEntries(selectors.map(selector => {
            const element = document.querySelector(selector); if (!element) throw new Error(`Missing ${selector}`);
            const style = getComputedStyle(element);
            return [selector, Object.fromEntries(['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','color','backgroundColor','borderRadius'].map(key => [key, style[key]]))];
          }));
        });
        // Compare every actual glyph with its article counterpart, including
        // output-viewer relations, evidence triggers, inventory and headers.
        const glyphs = await page.evaluate(() => {
          const roles = { analysis: 'analysis', input: 'input', decision: 'decision', output: 'output', finding: 'finding', prior_insight: 'insight', paper: 'insight' };
          return [...document.querySelectorAll('.astra-kind-glyph')].map(node => {
            const kind = node.dataset.kind;
            const reference = document.querySelector(`#inline .astra-kind-glyph[data-kind="${kind}"]`);
            const properties = ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];
            const read = element => Object.fromEntries(properties.map(key => [key, getComputedStyle(element)[key]]));
            const probe = document.createElement('span');
            probe.style.color = `var(--astra-color-kind-${roles[kind]})`;
            document.querySelector('#root').append(probe);
            const expectedColor = getComputedStyle(probe).color;
            probe.remove();
            return { kind, location: node.parentElement.className, actual: read(node), reference: read(reference), expectedColor };
          });
        });
        for (const selector of ['#inline .astra-inline-reference[data-kind="decision"]', '#details .astra-dialog[data-kind="output"] .astra-relation-list__trigger']) {
          const trigger = page.locator(selector).first();
          const glyph = trigger.locator('.astra-kind-glyph');
          const colour = () => glyph.evaluate(node => getComputedStyle(node).color);
          const original = await colour();
          await trigger.hover();
          assert.equal(await colour(), original, 'hover must preserve the glyph kind colour');
          if (selector.includes('trigger')) {
            await trigger.focus();
            assert.equal(await colour(), original, 'focus must preserve the glyph kind colour');
          }
        }
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement?.blur());
        assert.ok(glyphs.length > 30, 'exercise glyphs throughout the rendered UI');
        for (const glyph of glyphs) {
          assert.deepEqual(glyph.actual, glyph.reference, `${name}: ${glyph.kind} glyph in ${glyph.location} differs from article text`);
          assert.equal(glyph.actual.fontSize, '15px');
          assert.equal(glyph.actual.color, glyph.expectedColor, `${name}: ${glyph.kind} glyph must use its own kind colour`);
        }
        results[`${name}-${scheme}-${rootSize}`] = metrics;
        if (expected) assert.deepEqual(metrics, expected, `${name}/${scheme}/${rootSize} differs from shared UI`);
        else expected = metrics;
        const annotation = metrics['.astra-record-preview[data-value-product] .astra-record-preview__selection > span:last-child'];
        assert.match(annotation.fontFamily, /Lightcone Brand Newsreader/);
        assert.equal(annotation.fontStyle, 'italic');
        assert.match(metrics['.astra-record-preview__source'].fontFamily, /IBM Plex Mono/);
        assert.equal(metrics['#inline .astra-inline-reference'].fontSize, '17px');
        assert.equal(metrics['.astra-record-preview__header .astra-surface-header__title'].fontSize, '20px');
        assert.equal(metrics['.astra-record-preview__header .astra-surface-header__eyebrow'].fontSize, '10px');
        assert.equal(metrics['#details .astra-surface-header__title'].fontSize, '20px');
        assert.equal(metrics['.astra-record-preview[data-entry-kind="value"] .astra-surface-header__eyebrow'].color, scheme === 'dark' ? 'rgb(111, 160, 174)' : 'rgb(63, 114, 128)');
        assert.equal(await page.locator('.astra-record-preview__option-status').first().evaluate(node => getComputedStyle(node).width), '1px');
        if (rootSize === 16) {
          await page.locator('#previews').screenshot({ path: join(output, `${name}-${scheme}.png`) });
          await page.locator('#details .astra-dialog[data-kind="output"]').screenshot({ path: join(output, `${name}-output-viewer-${scheme}.png`) });
        }
        // Article prose and nested UI must also work when only the document
        // carries the scheme; UI defaults must not reset inherited brand colours.
        const colours = await page.evaluate(() => {
          for (const node of document.querySelectorAll('body .lightcone-brand')) {
            delete node.dataset.lightconeColorScheme;
            delete node.dataset.astraColorScheme;
          }
          return ['#brand-prose', '#root'].map(selector => {
            const style = getComputedStyle(document.querySelector(selector));
            return [style.color, style.getPropertyValue('--astra-color-canvas').trim().toLowerCase()];
          });
        });
        assert.deepEqual(colours, Array(2).fill([
          scheme === 'dark' ? 'rgb(241, 239, 233)' : 'rgb(34, 31, 32)',
          scheme === 'dark' ? '#221f20' : '#ffffff',
        ]), `${name}: prose and UI share document-level brand tokens`);

      }
    }
    assert.deepEqual(results[`shared-${scheme}-16`], results[`shared-${scheme}-20`], 'UI sizing must not depend on host root font size');
  }
  await writeFile(join(output, 'computed-styles.json'), JSON.stringify(results, null, 2));
  console.log('Rendering contract passed: four CSS environments, light/dark, 16px/20px host roots.');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true, force: true });
}
