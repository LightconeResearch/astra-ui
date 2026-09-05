import type { Story } from '@ladle/react';
import type { ResolvedOutput } from '@astra-spec/sdk';
import { ArtifactPreview, type ArtifactPreviewData, type ArtifactRenderer } from '@astra-spec/ui/components';
import { Inventory } from '@astra-spec/ui/views';
import { analysisDocument } from './host';

export default { title: 'Outputs' };

// Illustrative results exercise density, units, long names, and async states.
const metrics: { label: string; preview?: ArtifactPreviewData }[] = [
  { label: 'BAO scale, α∥', preview: { kind: 'metric', value: 1.012345678, uncertainty: 0.024567891, label: 'Parallel scale' } },
  { label: 'BAO scale, α⊥', preview: { kind: 'metric', value: '0.997123456', uncertainty: '0.018123456' } },
  { label: 'Detection significance', preview: { kind: 'metric', value: 5.2, unit: 'σ' } },
  { label: 'Goodness of fit', preview: { kind: 'metric', value: 1.08 } },
  { label: 'Reconstruction smoothing radius', preview: { kind: 'metric', value: 15, unit: 'Mpc/h' } },
  { label: 'Correlation coefficient', preview: { kind: 'metric', value: -0.42731 } },
  { label: 'Held-out validation score' },
  { label: 'Effective sample size', preview: { kind: 'loading' } },
  { label: 'Model comparison', preview: { kind: 'unavailable', reason: 'Preview unavailable' } },
];
const files: [string, string][] = [
  ['BAO fit results', 'json'],
  ['Posterior samples', 'npz'],
  ['Fit diagnostics', 'csv'],
  ['Model configuration', 'json'],
  ['Correlation function covariance matrix', 'npy'],
  ['Validation residuals', 'csv'],
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
const sampleDocument = {
  ...analysisDocument,
  analysis: { ...analysisDocument.analysis, outputs },
};
const renderArtifact: ArtifactRenderer = (output, { compact }) => {
  if (output.type !== 'metric') return null;
  const preview = metrics.find(({ label }) => label === output.label)?.preview;
  return <ArtifactPreview output={output} preview={preview} compact={compact} />;
};

export const CompactGrid: Story = () => (
  <Inventory document={sampleDocument} sections={['outputs']} showOutline={false} renderArtifact={renderArtifact} />
);

export const NarrowPanel: Story = () => (
  <div style={{ width: 360, maxWidth: '100%' }}>
    <CompactGrid />
  </div>
);
