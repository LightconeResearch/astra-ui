import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineReference, KindGlyph } from '../../packages/react/dist/primitives/index.js';

describe('shared editorial inline references', () => {
  it('preserves native link navigation, handlers and refs without adding a second focus target', () => {
    const click = vi.fn();
    const ref = createRef<HTMLSpanElement>();
    render(<InlineReference kind="input" asChild ref={ref}><a href="#catalog" onClick={click}>Catalogue</a></InlineReference>);
    const link = screen.getByRole('link', { name: 'Catalogue' });
    expect(ref.current).toBe(link);
    expect(link.getAttribute('href')).toBe('#catalog');
    expect(link.querySelector('[data-slot="kind-glyph"]')?.textContent).toBe('▤');
    fireEvent.click(link);
    expect(click).toHaveBeenCalledOnce();
  });

  it('keeps values glyph-free and leaves number formatting to the host', () => {
    const { container } = render(<InlineReference kind="value"><strong>0.42 ± 0.03</strong></InlineReference>);
    expect(screen.getByText('0.42 ± 0.03').tagName).toBe('STRONG');
    expect(container.querySelector('[data-slot="kind-glyph"]')).toBeNull();
  });

  it('shares the decision mark with options and hides decorative marks from accessible names', () => {
    const { container } = render(<><InlineReference kind="option">Fiducial</InlineReference><KindGlyph kind="decision" /></>);
    const glyphs = [...container.querySelectorAll('[data-slot="kind-glyph"]')];
    expect(glyphs.map(node => node.textContent)).toEqual(['◇', '◇']);
    expect(glyphs.every(node => node.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
