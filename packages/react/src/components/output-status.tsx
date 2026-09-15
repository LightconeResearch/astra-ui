import { forwardRef, type HTMLAttributes } from 'react';
import { Tooltip } from '../primitives/tooltip.js';
import { outputStatusIconPath, type OutputStatus } from '../lib/output-status.js';
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
  if (!status || status.state === 'materialized') return null;
  const label = labels.status[status.state];
  const reason = status.detail?.trim();
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d={outputStatusIconPath[status.state]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Tooltip>
  );
});
