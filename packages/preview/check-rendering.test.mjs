import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { checkRendering } from './check-rendering.mjs';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('checks the glyph’s own kind inside a differently coloured dialog', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>
      .lightcone-brand { --astra-color-kind-insight: #a45a43; --astra-color-kind-output: #487866; }
      dialog { color: var(--astra-color-kind-output); }
      .astra-kind-glyph { color: var(--astra-color-kind-insight); }
    </style><dialog class="lightcone-brand" open><span class="astra-kind-glyph" data-kind="prior_insight">◈</span></dialog>`);
    await checkRendering(page);
    await page.locator('.astra-kind-glyph').evaluate(glyph => { glyph.style.color = 'black'; });
    await assert.rejects(checkRendering(page), /prior_insight glyph/);
    await page.locator('dialog').evaluate(dialog => { dialog.className = ''; });
    await assert.rejects(checkRendering(page), /outside the Lightcone brand scope/);
    await page.setContent('<div class="lightcone-brand"><span class="astra-kind-glyph" data-kind="prior_insight">◈</span></div>');
    await assert.rejects(checkRendering(page), /Missing Lightcone colour token/);
  } finally {
    await page.close();
  }
});

test('catches doubled padding from an older publication theme', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>
      .astra-preview-popover__surface { width: 440px; border: 1px solid; }
      .astra-record-preview { padding: 19px 20px; }
    </style><div class="astra-preview-popover__surface"><div class="astra-preview-popover__scroll">
      <article class="astra-record-preview"><header class="astra-record-preview__header">Reference title</header></article>
    </div></div>`);
    await checkRendering(page);
    await page.addStyleTag({ content: '.astra-preview-popover__surface { padding: 19px 20px; }' });
    await assert.rejects(checkRendering(page), /Popover left inset: 40px, expected 20px/);
  } finally {
    await page.close();
  }
});
