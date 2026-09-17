import type { Story } from '@ladle/react';
import type { ResolvedOutput } from '@astra-spec/sdk';
import { useEffect, useRef, type ComponentProps } from 'react';
import {
  ArtifactPreview, OutputProvenance, OutputStatusIndicator, type ArtifactRenderer,
} from '@astra-spec/ui/components';
import type { ArtifactPreviewData, OutputStatus, OutputStatusLookup } from '@astra-spec/ui/lib';
import { Inventory } from '@astra-spec/ui/views';
import { analysisDocument, sampleRun } from './host';

export default { title: 'Outputs' };

// Illustrative results exercise density, units, long names, and async states.
const metrics: { label: string; preview?: ArtifactPreviewData; status?: OutputStatus }[] = [
  { label: 'BAO scale, α∥', preview: { kind: 'metric', value: 1.012345678, uncertainty: 0.024567891, label: 'Parallel scale' } },
  { label: 'BAO scale, α⊥', preview: { kind: 'metric', value: '0.997123456', uncertainty: '0.018123456' } },
  { label: 'Detection significance', preview: { kind: 'metric', value: 5.2, unit: 'σ' } },
  { label: 'Goodness of fit', preview: { kind: 'metric', value: 1.08 }, status: { state: 'behind', detail: 'made under an earlier environment' } },
  { label: 'Reconstruction smoothing radius', preview: { kind: 'metric', value: 15, unit: 'Mpc/h' } },
  { label: 'Correlation coefficient', preview: { kind: 'metric', value: -0.42731 } },
  { label: 'Held-out validation score', status: { state: 'stale' } },
  { label: 'Effective sample size', preview: { kind: 'loading' } },
  { label: 'Model comparison', preview: { kind: 'unavailable', reason: 'Preview unavailable' } },
];
const files: [string, string, OutputStatus?][] = [
  ['BAO fit results', 'json'],
  ['Posterior samples', 'npz', { state: 'stale', detail: 'no manifest — it has never been materialized' }],
  ['Fit diagnostics', 'csv'],
  ['Model configuration', 'json'],
  ['Correlation function covariance matrix', 'npy'],
  ['Validation residuals', 'csv', { state: 'behind' }],
];
const base = analysisDocument.analysis.outputs[0];
if (!base) throw new Error('The playground needs an example output.');
const outputs: ResolvedOutput[] = [
  ...metrics.map(({ label, preview }, i): ResolvedOutput => {
    const output: ResolvedOutput = {
      ...base, id: `metric_${i}`, canonicalPath: `outputs.metric_${i}`,
      label, type: 'metric', format: 'json', active: true,
      artifact: { byteSize: 128 },
    };
    if (!preview) delete output.artifact;
    return output;
  }),
  ...files.map(([label, format], i): ResolvedOutput => ({
    ...base, id: `file_${i}`, canonicalPath: `outputs.file_${i}`,
    label, type: 'data', format, active: true,
    artifact: { byteSize: 128 },
  })),
];
const statusByLabel = new Map<string, OutputStatus>();
for (const { label, status } of metrics) if (status) statusByLabel.set(label, status);
for (const [label, , status] of files) if (status) statusByLabel.set(label, status);
const renderArtifact: ArtifactRenderer = (output, { compact }) => {
  if (output.type !== 'metric') return null;
  const preview = metrics.find(({ label }) => label === output.label)?.preview;
  return <ArtifactPreview output={output} preview={preview} compact={compact} />;
};
const getOutputStatus: OutputStatusLookup = (output) => (output.label ? statusByLabel.get(output.label) : undefined);
const sampleDocument = {
  ...analysisDocument,
  analysis: { ...analysisDocument.analysis, outputs },
};

export const CompactGrid: Story = () => (
  <Inventory document={sampleDocument} sections={['outputs']} showOutline={false} renderArtifact={renderArtifact} getOutputStatus={getOutputStatus} />
);

export const NarrowPanel: Story = () => (
  <div style={{ width: 360, maxWidth: '100%' }}>
    <CompactGrid />
  </div>
);

// The marker only appears for behind or stale results; current results stay
// quiet, so a `current` example next to the others shows that contrast.
export const Statuses: Story = () => (
  <div className="playground-row" style={{ alignItems: 'center', gap: 24 }}>
    {([
      { state: 'current' },
      { state: 'behind' },
      { state: 'behind', detail: 'made under an earlier environment' },
      { state: 'stale' },
      { state: 'stale', detail: 'no manifest — it has never been materialized' },
    ] as OutputStatus[]).map((status) => (
      <span key={`${status.state}-${status.detail ?? ''}`} style={{ display: 'grid', justifyItems: 'center', gap: 8, font: '11px/1.4 var(--astra-font-ui)' }}>
        <span style={{ position: 'relative', width: 32, height: 32, border: '1px dashed var(--astra-color-border-subtle)', borderRadius: 6 }}>
          <OutputStatusIndicator status={status} style={{ position: 'absolute', top: 2, right: 2 }} />
        </span>
        {status.state}{status.detail ? ' (with detail)' : ''}
      </span>
    ))}
  </div>
);

/** Auto-opens the run-details popup on mount, so the story captures that surface too. */
function OpenedProvenance(props: ComponentProps<typeof OutputProvenance>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
  }, []);
  return <OutputProvenance ref={ref} {...props} />;
}

export const Provenance: Story = () => (
  <div className="playground-stack playground-frame" style={{ maxWidth: 420 }}>
    <OutputProvenance status={{ state: 'current' }} run={sampleRun} />
    <OutputProvenance status={{ state: 'behind', detail: 'made under an earlier environment' }} run={sampleRun} />
    <OutputProvenance status={{ state: 'stale', detail: 'no manifest — it has never been materialized' }} run={null} />
    <OutputProvenance />
    <OutputProvenance error="Could not read the recorded run." />
  </div>
);

export const ProvenanceDetails: Story = () => (
  <div className="playground-frame" style={{ maxWidth: 420 }}>
    <OpenedProvenance status={{ state: 'current' }} run={sampleRun} />
  </div>
);
