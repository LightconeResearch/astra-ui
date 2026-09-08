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
      {kind === 'paper' ? (
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
          <path d="M14 3v5h5M8 12h8M8 16h6" />
        </svg>
      ) : surfaceGlyph(kind)}
    </span>
  );
});
