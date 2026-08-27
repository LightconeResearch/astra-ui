import { chromium } from 'playwright';
const S = '/tmp/claude-1000/-home-francois-repo-astra-ui/aa1b3297-43d6-4c64-a7a3-3689de4446b7/scratchpad/legacy';
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const name of ['old-header','new-header']) {
  await page.goto(`file://${S}/${name}.html`, { waitUntil: 'networkidle' }); await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const pick = (el) => { const cs = getComputedStyle(el); return { fontSize: cs.fontSize, fontFamily: cs.fontFamily.slice(0,14), fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, marginTop: cs.marginTop, w: cs.width, h: cs.height, pad: cs.padding, display: cs.display, placeItems: cs.placeItems, alignItems: cs.alignItems }; };
    return { modalTitle: pick(document.querySelector('#modal h3')), embeddedTitle: pick(document.querySelector('#embedded h3')), back: pick(document.querySelector('#modal [class*="__back"]')), backSpan: pick(document.querySelector('#modal [class*="__back"] span')), header: pick(document.querySelector('#modal header')) };
  });
  console.log(name, JSON.stringify(info));
}
await browser.close();
