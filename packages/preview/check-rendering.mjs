// Check the actual page being sent to Argos. Resolving
// the semantic token in the glyph's own scope also catches broken portal theming.
export async function checkRendering(page) {
  const failures = await page.evaluate(() => {
    const failures = [...document.querySelectorAll('.astra-kind-glyph')].flatMap(glyph => {
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
      const icon = glyph.querySelector('svg');
      if (icon && getComputedStyle(icon).stroke !== actual) return [`${kind} icon does not inherit its glyph colour`];
      return actual === expected ? [] : [`${kind} glyph: ${actual}, expected ${expected}`];
    });
    for (const surface of document.querySelectorAll('.astra-preview-popover__surface')) {
      const header = surface.querySelector(':scope > .astra-preview-popover__scroll > .astra-record-preview > .astra-record-preview__header');
      if (!header || !header.getClientRects().length) continue;
      const outer = surface.getBoundingClientRect();
      const inner = header.getBoundingClientRect();
      const style = getComputedStyle(surface);
      const insets = {
        top: inner.top - outer.top - parseFloat(style.borderTopWidth),
        left: inner.left - outer.left - parseFloat(style.borderLeftWidth),
        right: outer.right - inner.right - parseFloat(style.borderRightWidth),
      };
      // The shared card owns the article reference's 19px/20px inset. Checking
      // geometry catches padding added by any intervening host wrapper too.
      for (const [side, expected] of Object.entries({ top: 19, left: 20, right: 20 })) {
        if (Math.abs(insets[side] - expected) > 0.5) failures.push(`Popover ${side} inset: ${insets[side]}px, expected ${expected}px`);
      }
    }
    return failures;
  });
  if (failures.length) throw new Error(`${page.url()}: ${[...new Set(failures)].join('; ')}`);
}
