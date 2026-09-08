// Check computed glyph colours in the actual page being sent to Argos. Resolving
// the semantic token in the glyph's own scope also catches broken portal theming.
export async function checkBrand(page) {
  const failures = await page.evaluate(() => {
    return [...document.querySelectorAll('.astra-kind-glyph')].flatMap(glyph => {
      if (!glyph.getClientRects().length) return [];
      const scope = glyph.closest('.lightcone-brand');
      if (!scope) return ['Glyph rendered outside the Lightcone brand scope'];
      const kind = glyph.getAttribute('data-kind');
      const token = kind === 'prior_insight' || kind === 'paper' ? 'insight' : kind;
      if (!getComputedStyle(glyph).getPropertyValue(`--astra-color-kind-${token}`).trim()) {
        return [`Missing Lightcone colour token for ${kind}`];
      }
      const probe = document.createElement('span');
      probe.style.color = `var(--astra-color-kind-${token})`;
      glyph.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      const actual = getComputedStyle(glyph).color;
      return actual === expected ? [] : [`${kind} glyph: ${actual}, expected ${expected}`];
    });
  });
  if (failures.length) throw new Error(`${page.url()}: ${[...new Set(failures)].join('; ')}`);
}
