import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { checkBrand } from './check-brand.mjs';

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
    await checkBrand(page);
    await page.locator('.astra-kind-glyph').evaluate(glyph => { glyph.style.color = 'black'; });
    await assert.rejects(checkBrand(page), /prior_insight glyph/);
    await page.locator('dialog').evaluate(dialog => { dialog.className = ''; });
    await assert.rejects(checkBrand(page), /outside the Lightcone brand scope/);
    await page.setContent('<div class="lightcone-brand"><span class="astra-kind-glyph" data-kind="prior_insight">◈</span></div>');
    await assert.rejects(checkBrand(page), /Missing Lightcone colour token/);
  } finally {
    await page.close();
  }
});
