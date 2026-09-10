import type { ResolvedAnalysisNode, ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, useId, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import type { ArtifactRenderer } from '../components/artifact-preview.js';
import { EmptyState } from '../primitives/record-list.js';
import { OutputCard } from '../components/output-card.js';
import { OutputEntry } from '../components/output-entry.js';

export interface OutputsListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  analysis: ResolvedAnalysisNode;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpenRecord: (output: ResolvedOutput, analysis: ResolvedAnalysisNode) => void;
}

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

function CompactOutputs({
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
      <ul className="astra-inventory-outputs__compact-grid" data-layout={outputs[0]?.type === 'metric' ? 'tiles' : 'grid'}>
        {outputs.map((output) => (
          <li key={output.canonicalPath}>
            <OutputEntry
              output={output}
              renderArtifact={renderArtifact}
              onOpen={() => { onOpen(output); }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const GROUPED_TYPES = new Set<ResolvedOutput['type']>(['figure', 'table', 'metric']);

/** Figures and tables as galleries, metrics as compact tiles, files as a compact grid. */
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
  const metrics = analysis.outputs.filter(({ type }) => type === 'metric');
  const files = analysis.outputs.filter(({ type }) => !GROUPED_TYPES.has(type));
  if (!analysis.outputs.length) {
    return <EmptyState data-slot="outputs-list" {...props} ref={ref} className={className}>{labels.empty.outputs}</EmptyState>;
  }
  const open = (output: ResolvedOutput) => { onOpenRecord(output, analysis); };
  return (
    <div data-slot="outputs-list" {...props} ref={ref} className={cn('astra-inventory-outputs', className)}>
      <OutputGallery title="Figures" outputs={figures} renderArtifact={renderArtifact} onOpen={open} />
      <OutputGallery title="Tables" outputs={tables} renderArtifact={renderArtifact} onOpen={open} />
      <CompactOutputs title="Metrics" outputs={metrics} renderArtifact={renderArtifact} onOpen={open} />
      <CompactOutputs title="Output files" outputs={files} onOpen={open} />
    </div>
  );
});
