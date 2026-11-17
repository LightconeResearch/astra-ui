import { forwardRef, type HTMLAttributes } from 'react';
import { Tooltip } from '../primitives/tooltip.js';
import { OutputStatusGlyph } from '../primitives/output-status-glyph.js';
import type { Status } from '@astra-spec/sdk/reports';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';

export interface OutputStatusIndicatorProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status?: Status | undefined;
}

/** A corner marker calls attention only to results that need action. */
export const OutputStatusIndicator = forwardRef<HTMLSpanElement, OutputStatusIndicatorProps>(function OutputStatusIndicator({
  status,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  if (!status || status.state === 'unchanged' && status.bytes?.state !== 'absent') return null;
  // An unchanged result is marked only for its absent bytes, which a rebuild
  // restores: it wears the missing mark, not a checkmark in the stale colour.
  const marker = status.state === 'unchanged' ? 'missing' : status.state;
  const label = labels.status[status.state];
  const reason = [...status.why.map(item => item.message), ...(status.bytes?.state === 'absent' ? [labels.status.bytesUnavailable] : [])].join(' ').trim();
  const explanation = reason ? labels.status.withDetail(label, reason) : label;
  return (
    <Tooltip content={explanation}>
      <span
        data-slot="output-status"
        role="img"
        aria-label={explanation}
        {...props}
        ref={ref}
        className={cn('astra-output-status', className)}
        data-state={marker}
      >
        <OutputStatusGlyph state={marker} />
      </span>
    </Tooltip>
  );
});
