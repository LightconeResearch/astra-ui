import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { OutputPreview } from './output-detail.js';

export interface OutputCardProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: ResolvedOutput;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/** A gallery card: compact preview and title, with a type label for non-figures. */
export const OutputCard = forwardRef<HTMLButtonElement, OutputCardProps>(function OutputCard({
  output,
  renderArtifact,
  onOpen,
  className,
  onClick,
  'aria-label': hostLabel,
  ...props
}, ref) {
  return (
    <button
      data-slot="output-card"
      {...props}
      ref={ref}
      type="button"
      aria-label={hostLabel ?? `Open ${output.type}: ${recordTitle(output)}`}
      className={cn('astra-output-card', className)}
      onClick={(event) => { onClick?.(event); onOpen(); }}
    >
      <span className="astra-output-card__preview">
        <OutputPreview output={output} compact renderArtifact={renderArtifact} />
        <span className="astra-output-card__open" aria-hidden="true">Open ↗</span>
      </span>
      <span className="astra-output-card__body">
        {output.type !== 'figure' ? <span className="astra-output-card__kind">{output.type}</span> : null}
        <strong>{recordTitle(output)}</strong>
        {output.label ? <code>{output.id}</code> : null}
      </span>
    </button>
  );
});
