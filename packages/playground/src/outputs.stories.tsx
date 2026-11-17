import type { Story } from '@ladle/react';
import type { Output, Status, StatusReport } from '@astra-spec/sdk/reports';
import { useEffect, useRef, type ComponentProps } from 'react';
import {
  ArtifactPreview, OutputProvenance, OutputStatusIndicator, type ArtifactRenderer,
} from '@astra-spec/ui/components';
import type { ArtifactPreviewData } from '@astra-spec/ui/lib';
import { Inventory } from '@astra-spec/ui/views';
import { analysisDocument, sampleRun, analysisRoot } from './host';
export default { title: 'Outputs' };
const status = (state: Status['state'], message?: string): Status => ({
  state,
  why: message
    ? [{ code: 'STORY', level: 'note', message, location: { file: 'astra.yaml', pointer: '' }, related: [] }]
    : [],
  stale_inputs: [],
});
const metrics: { label: string; preview?: ArtifactPreviewData; status?: Status }[] = [
  {
    label: 'BAO scale, α∥',
    preview: { kind: 'metric', value: 1.012345678, uncertainty: 0.024567891, label: 'Parallel scale' },
  },
  { label: 'BAO scale, α⊥', preview: { kind: 'metric', value: '0.997123456', uncertainty: '0.018123456' } },
  { label: 'Detection significance', preview: { kind: 'metric', value: 5.2, unit: 'σ' } },
  { label: 'Goodness of fit', preview: { kind: 'metric', value: 1.08 }, status: status('stale', 'An input changed') },
  { label: 'Reconstruction smoothing radius', preview: { kind: 'metric', value: 15, unit: 'Mpc/h' } },
  { label: 'Correlation coefficient', preview: { kind: 'metric', value: -0.42731 } },
  { label: 'Held-out validation score', status: status('missing') },
  { label: 'Effective sample size', preview: { kind: 'loading' } },
  { label: 'Model comparison', preview: { kind: 'unavailable', reason: 'Preview unavailable' } },
];
const files: [string, string, Status?][] = [
  ['BAO fit results', 'json'],
  ['Posterior samples', 'npz', status('missing', 'No provenance record')],
  ['Fit diagnostics', 'csv'],
  ['Model configuration', 'json'],
  ['Correlation function covariance matrix', 'npy'],
  ['Validation residuals', 'csv', status('stale')],
];
const outputs: Output[] = [
  ...metrics.map(({ label }, index) => ({
    ref: `outputs.metric_${index}`,
    label,
    type: 'metric',
    format: 'json',
    tags: [],
    decisions: [],
  })),
  ...files.map(([label, format], index) => ({
    ref: `outputs.file_${index}`,
    label,
    type: 'data',
    format,
    tags: [],
    decisions: [],
  })),
];
const statuses: Record<string, Status> = {};
metrics.forEach((metric, index) => {
  if (metric.status) statuses[`outputs.metric_${index}`] = metric.status;
});
files.forEach(([, , record], index) => {
  if (record) statuses[`outputs.file_${index}`] = record;
});
const statusReport: StatusReport = {
  schema_version: 'astra-tools.status-report.v1',
  statuses,
  inputs: {},
  evidence: [],
};
const sampleDocument = {
  ...analysisDocument,
  analyses: [{ ...analysisRoot, outputs }, ...analysisDocument.analyses.slice(1)],
  results: outputs.map((output) => ({ id: output.ref, output: output.ref, inputs: [], places: [] })),
};
const renderArtifact: ArtifactRenderer = (output, { compact, result, status }) => {
  if (output.type !== 'metric') return null;
  const preview = metrics.find(({ label }) => label === output.label)?.preview;
  return <ArtifactPreview output={output} result={result} status={status} preview={preview} compact={compact} />;
};
export const CompactGrid: Story = () => (
  <Inventory
    document={sampleDocument}
    statusReport={statusReport}
    sections={['outputs']}
    showOutline={false}
    renderArtifact={renderArtifact}
  />
);

export const NarrowPanel: Story = () => (
  <div style={{ width: 360, maxWidth: '100%' }}>
    <CompactGrid />
  </div>
);
export const Statuses: Story = () => (
  <div className="playground-row" style={{ alignItems: 'center', gap: 24 }}>
    {[
      status('unchanged'),
      status('missing'),
      status('missing', 'No provenance record'),
      status('stale'),
      status('stale', 'An input changed'),
      { ...status('unchanged'), bytes: { state: 'absent' as const } },
    ].map((record, index) => (
      <span
        key={index}
        style={{ display: 'grid', justifyItems: 'center', gap: 8, font: '11px/1.4 var(--astra-font-ui)' }}
      >
        <span
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            border: '1px dashed var(--astra-color-border-subtle)',
            borderRadius: 6,
          }}
        >
          <OutputStatusIndicator status={record} style={{ position: 'absolute', top: 2, right: 2 }} />
        </span>
        {record.state}
        {record.why.length ? ' (with diagnostic)' : ''}
      </span>
    ))}
  </div>
);
function OpenedProvenance(props: ComponentProps<typeof OutputProvenance>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
  }, []);
  return <OutputProvenance ref={ref} {...props} />;
}

export const Provenance: Story = () => (
  <div className="playground-stack playground-frame" style={{ maxWidth: 420 }}>
    <OutputProvenance status={{ ...status('unchanged'), bytes: { state: 'present' }, record: sampleRun }} />
    <OutputProvenance
      status={{ ...status('stale', 'An input changed'), bytes: { state: 'present' }, record: sampleRun }}
    />
    <OutputProvenance status={status('missing', 'No provenance record')} />
  </div>
);

export const ProvenanceDetails: Story = () => (
  <OpenedProvenance status={{ ...status('unchanged'), record: sampleRun }} />
);
