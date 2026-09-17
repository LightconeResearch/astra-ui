import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import type { OutputStatus } from '../model/output-status.js';
import { OutputStatusIndicator } from './output-status.js';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import type { ArtifactRenderer } from './artifact-preview.js';

export interface OutputEntryProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: ResolvedOutput;
  status?: OutputStatus | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/**
 * One output at a glance, for the types a gallery card would waste space on: a
 * metric reads as its value over its name, anything else as its name. The row
 * it wraps in decides how a run of these is laid out.
 */
export const OutputEntry = forwardRef<HTMLButtonElement, OutputEntryProps>(function OutputEntry({
  output,
  status,
  renderArtifact,
  onOpen,
  className,
  onClick,
  'aria-label': hostLabel,
  ...props
}, ref) {
  const title = recordTitle(output);
  const metric = output.type === 'metric';
  // Why the document itself has nothing to show, before any host status.
  const absenceNote = !output.active ? 'Inactive' : !output.artifact ? 'Not yet generated' : undefined;
  return (
    <button
      data-slot="output-entry"
      {...props}
      ref={ref}
      type="button"
      className={cn('astra-output-entry', className)}
      data-kind={metric ? 'metric' : 'file'}
      aria-label={hostLabel ?? `Open ${output.type}: ${title}`}
      onClick={(event) => { onClick?.(event); onOpen(); }}
    >
      <OutputStatusIndicator status={status} />
      <span className="astra-output-entry__name">
        {title}
        {!metric && absenceNote && !status ? <span className="astra-output-entry__status">{absenceNote}</span> : null}
      </span>
      {metric ? (
        <span className="astra-output-entry__value">
          {status?.state === 'stale' && !output.artifact
            ? <span className="astra-artifact__metric-value" aria-label="No value">–</span>
            : renderArtifact?.(output, { compact: true })
              ?? <span className="astra-output-entry__status">{absenceNote ?? 'Preview unavailable'}</span>}
        </span>
      ) : null}
    </button>
  );
});
