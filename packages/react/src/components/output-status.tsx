import { forwardRef, type HTMLAttributes } from 'react';
import type { OutputStatus } from '../lib/output-status.js';
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
  return (
    <span
      data-slot="output-status"
      role="img"
      aria-label={label}
      title={status.detail ? labels.status.withDetail(label, status.detail) : label}
      {...props}
      ref={ref}
      className={cn('astra-output-status', className)}
      data-state={status.state}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {status.state === 'outdated'
          ? <path d="M12.5 5A5 5 0 1 0 13 9M12.5 1.5V5H9" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="m4.5 4.5 7 7m0-7-7 7" strokeLinecap="round" />}
      </svg>
    </span>
  );
});
