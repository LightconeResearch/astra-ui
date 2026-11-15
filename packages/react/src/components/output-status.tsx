import { forwardRef, type HTMLAttributes } from 'react';
import { Tooltip } from '../primitives/tooltip.js';
import { OutputStatusGlyph } from '../primitives/output-status-glyph.js';
import type { OutputStatus } from '../model/output-status.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';

export interface OutputStatusIndicatorProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status?: OutputStatus | undefined;
}

/** A corner marker calls attention only to results that need action. */
export const OutputStatusIndicator = forwardRef<HTMLSpanElement, OutputStatusIndicatorProps>(function OutputStatusIndicator({
  status,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  if (!status || status.state === 'unchanged' && status.bytes?.state !== 'absent') return null;
  const label = labels.status[status.state];
  const reason = [...status.why.map(item => item.message), ...(status.bytes?.state === 'absent' ? ['Recorded bytes are unavailable.'] : [])].join(' ').trim();
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
        data-state={status.state}
      >
        <OutputStatusGlyph state={status.state} />
      </span>
    </Tooltip>
  );
});
