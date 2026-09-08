import { forwardRef, type HTMLAttributes } from 'react';
import { surfaceGlyph, type SurfaceKind } from '../model/kind.js';
import { cn } from '../lib/cn.js';

export interface KindGlyphProps extends HTMLAttributes<HTMLSpanElement> {
  kind: SurfaceKind;
}

/** Decorative kind mark. Its kind selects both symbol and colour; typography is shared across surfaces. */
export const KindGlyph = forwardRef<HTMLSpanElement, KindGlyphProps>(function KindGlyph({
  kind, className, ...props
}, ref) {
  return (
    <span data-slot="kind-glyph" {...props} ref={ref} className={cn('astra-kind-glyph', className)} data-kind={kind} aria-hidden="true">
      {surfaceGlyph(kind)}
    </span>
  );
});
