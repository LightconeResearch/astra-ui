import type { Output, Result } from '@astra-spec/sdk/reports';
import { forwardRef, type HTMLAttributes } from 'react';
import type { Status } from '@astra-spec/sdk/reports';
import { OutputStatusIndicator } from './output-status.js';
import { recordTitle, recordId } from '../model/records.js';
import { cn } from '../lib/cn.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { OutputPreview } from './output-detail.js';

export interface OutputCardProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: Output;
  result?: Result | undefined;
  universeRef?: string | undefined;
  status?: Status | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/** A gallery card: compact preview and title, with a type label for non-figures. */
export const OutputCard = forwardRef<HTMLButtonElement, OutputCardProps>(function OutputCard(
  {
    output,
    result,
    universeRef,
    status,
    renderArtifact,
    onOpen,
    className,
    onClick,
    'aria-label': hostLabel,
    ...props
  },
  ref,
) {
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
        <OutputPreview
          output={output}
          result={result}
          status={status}
          universeRef={universeRef}
          compact
          renderArtifact={renderArtifact}
        />
        <span className="astra-output-card__open" aria-hidden="true">
          Open ↗
        </span>
      </span>
      <span className="astra-output-card__body">
        {output.type !== 'figure' ? <span className="astra-output-card__kind">{output.type}</span> : null}
        <strong>{title}</strong>
        {output.label ? <code>{recordId(output)}</code> : null}
      </span>
    </button>
  );
});
