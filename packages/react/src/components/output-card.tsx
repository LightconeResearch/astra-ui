import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import type { OutputStatus } from '../lib/output-status.js';
import { OutputStatusIndicator } from './output-status.js';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { OutputPreview } from './output-detail.js';

export interface OutputCardProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: ResolvedOutput;
  status?: OutputStatus | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/** A gallery card: compact preview and title, with a type label for non-figures. */
export const OutputCard = forwardRef<HTMLButtonElement, OutputCardProps>(function OutputCard({
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
  return (
    <button
      data-slot="output-card"
      {...props}
      ref={ref}
      type="button"
      className={cn('astra-output-card', className)}
      aria-label={hostLabel ?? `Open ${output.type}: ${title}`}
      onClick={(event) => { onClick?.(event); onOpen(); }}
    >
      <OutputStatusIndicator status={status} />
      <span className="astra-output-card__preview">
        <OutputPreview output={output} compact renderArtifact={renderArtifact} />
        <span className="astra-output-card__open" aria-hidden="true">Open ↗</span>
      </span>
      <span className="astra-output-card__body">
        {output.type !== 'figure' ? <span className="astra-output-card__kind">{output.type}</span> : null}
        <strong>{title}</strong>
        {output.label ? <code>{output.id}</code> : null}
      </span>
    </button>
  );
});
