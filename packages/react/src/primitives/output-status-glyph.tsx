import { forwardRef, type SVGAttributes } from 'react';
import type { OutputStatus } from '../lib/output-status.js';

export interface OutputStatusGlyphProps extends SVGAttributes<SVGSVGElement> {
  state: OutputStatus['state'];
}

/** One 16×16 glyph per state, so every surface that draws a status draws the same mark. */
const paths: Record<OutputStatus['state'], string> = {
  current: 'm3.5 8 3 3 6-6',
  behind: 'M12.5 5A5 5 0 1 0 13 9M12.5 1.5V5H9',
  stale: 'm4.5 4.5 7 7m0-7-7 7',
};

/** Decorative execution-state mark; the surface around it supplies colour and the accessible name. */
export const OutputStatusGlyph = forwardRef<SVGSVGElement, OutputStatusGlyphProps>(function OutputStatusGlyph({
  state, ...props
}, ref) {
  return (
    <svg
      data-slot="output-status-glyph"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      {...props}
      ref={ref}
      data-state={state}
    >
      <path d={paths[state]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});
