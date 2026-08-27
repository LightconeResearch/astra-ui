import type { ResolvedAnalysisNode, ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, useId, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import type { ArtifactRenderer } from '../components/artifact-preview.js';
import { EmptyState, RecordIdentity, RecordList } from '../primitives/record-list.js';
import { OutputPreview } from '../components/output-detail.js';

export interface OutputsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpenRecord: (output: ResolvedOutput, analysis: ResolvedAnalysisNode) => void;
}

export interface OutputCardProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  output: ResolvedOutput;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}

/** A gallery card: compact preview, type, and title. */
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
        <span className="astra-output-card__kind">{output.type}</span>
        <strong>{recordTitle(output)}</strong>
        {output.label ? <code>{output.id}</code> : null}
      </span>
    </button>
  );
});

function OutputGallery({
  title,
  outputs,
  renderArtifact,
  onOpen,
}: {
  title: string;
  outputs: ResolvedOutput[];
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: (output: ResolvedOutput) => void;
}) {
  const id = useId();
  if (!outputs.length) return null;
  return (
    <section className="astra-inventory-outputs__group" aria-labelledby={id}>
      <h3 id={id} className="astra-inventory-outputs__group-heading">
        <span>{title}</span>
      </h3>
      <div className="astra-inventory-outputs__gallery">
        {outputs.map((output) => (
          <OutputCard
            key={output.canonicalPath}
            output={output}
            renderArtifact={renderArtifact}
            onOpen={() => { onOpen(output); }}
          />
        ))}
      </div>
    </section>
  );
}

function OutputFiles({ outputs, onOpen }: { outputs: ResolvedOutput[]; onOpen: (output: ResolvedOutput) => void }) {
  const id = useId();
  if (!outputs.length) return null;
  return (
    <section className="astra-inventory-outputs__group astra-inventory-outputs__files" aria-labelledby={id}>
      <h3 id={id} className="astra-inventory-outputs__group-heading">
        <span>Other outputs</span>
      </h3>
      <RecordList
        label="Other outputs"
        columnTemplate="minmax(14rem, 1fr) 1.5rem"
        columns={[
          { label: 'Output', className: 'astra-record-list__primary' },
          { className: 'astra-record-list__arrow' },
        ]}
        rows={outputs.map((output) => ({
          key: output.canonicalPath,
          accessibleLabel: recordTitle(output),
          onOpen: () => { onOpen(output); },
          cells: [
            <RecordIdentity
              kind="output"
              title={recordTitle(output)}
              subtitle={output.label ? output.id : output.format?.toUpperCase()}
            />,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </section>
  );
}

/** Figures and tables as galleries, everything else as a list. */
export const OutputsList = forwardRef<HTMLDivElement, OutputsListProps>(function OutputsList({
  analysis,
  renderArtifact,
  onOpenRecord,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const figures = analysis.outputs.filter(({ type }) => type === 'figure');
  const tables = analysis.outputs.filter(({ type }) => type === 'table');
  const files = analysis.outputs.filter(({ type }) => type !== 'figure' && type !== 'table');
  if (!analysis.outputs.length) {
    return <EmptyState data-slot="outputs-list" {...props} ref={ref} className={className}>{labels.empty.outputs}</EmptyState>;
  }
  const open = (output: ResolvedOutput) => { onOpenRecord(output, analysis); };
  return (
    <div data-slot="outputs-list" {...props} ref={ref} className={cn('astra-inventory-outputs', className)}>
      <OutputGallery title="Figures" outputs={figures} renderArtifact={renderArtifact} onOpen={open} />
      <OutputGallery title="Tables" outputs={tables} renderArtifact={renderArtifact} onOpen={open} />
      <OutputFiles outputs={files} onOpen={open} />
    </div>
  );
});
