import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import type { ArtifactRenderer } from './artifact-preview.js';

export interface OutputEntryProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: ResolvedOutput;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/**
 * One output at a glance, for the types a gallery card would waste space on: a
 * metric reads as its value over its name, anything else as its name and
 * format. The row it wraps in decides how a run of these is laid out.
 */
export const OutputEntry = forwardRef<HTMLButtonElement, OutputEntryProps>(function OutputEntry({
  output,
  renderArtifact,
  onOpen,
  className,
  onClick,
  'aria-label': hostLabel,
  ...props
}, ref) {
  const metric = output.type === 'metric';
  const status = !output.active ? 'Inactive' : !output.artifact ? 'Not yet generated' : undefined;
  return (
    <button
      data-slot="output-entry"
      {...props}
      ref={ref}
      type="button"
      className={cn('astra-output-entry', className)}
      data-kind={metric ? 'metric' : 'file'}
      aria-label={hostLabel ?? `Open ${output.type}: ${recordTitle(output)}`}
      onClick={(event) => { onClick?.(event); onOpen(); }}
    >
      <span className="astra-output-entry__name">
        {recordTitle(output)}
        {!metric && status ? <span className="astra-output-entry__status">{status}</span> : null}
      </span>
      {metric ? (
        <span className="astra-output-entry__value">
          {renderArtifact?.(output, { compact: true })
            ?? <span className="astra-output-entry__status">{status ?? 'Preview unavailable'}</span>}
        </span>
      ) : (
        <span className="astra-output-entry__format">
          {output.format ? output.format.replace(/^\./, '').toUpperCase() : 'FILE'}
        </span>
      )}
    </button>
  );
});
