import type { Story } from '@ladle/react';
import type { Output } from '@astra-spec/sdk/reports';
import { ArtifactPreview } from '@astra-spec/ui/components';
import {
  Badge,
  Button,
  IconButton,
  CountHeading,
  EmptyState,
  RecordIdentity,
  RecordList,
  RelationList,
  SurfaceHeader,
} from '@astra-spec/ui/primitives';
import { byRef } from './derive';
import { analysisDocument , fixtureArtifact , analysisRoot } from './host';

export default { title: 'Primitives' };

const noop = () => undefined;

export const Buttons: Story = () => (
  <div className="playground-stack">
    <div className="playground-row">
      <Button variant="primary">Primary</Button>
      <Button>Secondary</Button>
      <Button variant="quiet">Quiet</Button>
      <Button tone="accent">Accent</Button>
      <Button disabled>Disabled</Button>
      <Button size="small">Small</Button>
      <IconButton label="Close">×</IconButton>
    </div>
  </div>
);

export const Badges: Story = () => (
  <div className="playground-row">
    <Badge>Neutral</Badge>
    <Badge kind="input">Input</Badge>
    <Badge kind="decision">Decision</Badge>
    <Badge kind="output">Output</Badge>
    <Badge kind="finding">Finding</Badge>
    <Badge kind="prior_insight">Insight</Badge>
    <Badge status="ready">ready</Badge>
    <Badge status="stale">stale</Badge>
    <Badge tone="universe">baseline</Badge>
  </div>
);

export const Headers: Story = () => (
  <div className="playground-stack playground-frame">
    <SurfaceHeader
      kind="output"
      eyebrow="Output · DESI DR1 BAO"
      title="BAO fit plot"
      identifier="outputs.bao_fit_plot"
      actions={<IconButton label="Close">×</IconButton>}
    />
    <SurfaceHeader kind="decision" density="compact" eyebrow="Decision" title="Smoothing radius" />
    <SurfaceHeader density="inline" eyebrow="Inline" title="Inline header" />
  </div>
);

export const Artifacts: Story = () => {
  const figure = byRef<Output>(analysisDocument, 'outputs.bao_fit_plot');
  const table = byRef<Output>(analysisDocument, 'outputs.bao_distance_table');
  const data = byRef<Output>(analysisDocument, 'outputs.xi_pre_recon_bgs');
  return (
    <div className="playground-stack playground-frame">
      <ArtifactPreview output={figure} preview={{ kind: 'image', url: fixtureArtifact(figure)?.url ?? '' }} />
      <ArtifactPreview
        output={table}
        preview={{ kind: 'table', headers: ['tracer', 'z_eff', 'DM/rd', 'DH/rd'], rows: [['BGS', 0.295, '—', '—'], ['LRG1', 0.51, 13.62, 20.98]] }}
      />
      <ArtifactPreview output={data} preview={{ kind: 'metric', value: 1.0021, uncertainty: 0.012, unit: 'α_iso', label: 'BAO scale' }} />
      <ArtifactPreview output={data} preview={{ kind: 'text', text: 'alpha_iso = 1.0021 ± 0.012\nchi2/dof = 41.2/38' }} />
      <ArtifactPreview output={data} />
    </div>
  );
};

export const RecordLists: Story = () => (
  <div className="playground-frame">
    <RecordList
      label="Outputs"
      columnTemplate="minmax(14rem, 1fr) 6.875rem 1.5rem"
      columns={[
        { label: 'Output', className: 'astra-record-list__primary' },
        { label: 'Type', className: 'astra-record-list__secondary' },
        { className: 'astra-record-list__arrow' },
      ]}
      rows={analysisRoot.outputs.slice(0, 5).map((record) => ({
        key: record.ref,
        accessibleLabel: record.label ?? record.ref,
        onOpen: noop,
        cells: [
          <RecordIdentity kind="output" title={record.label ?? record.ref} subtitle={record.ref} />,
          <span className="astra-record-list__tag">{record.type}</span>,
          <span aria-hidden="true">→</span>,
        ],
      }))}
    />
    <EmptyState>No records match this filter.</EmptyState>
  </div>
);

export const Relations: Story = () => (
  <div className="playground-frame">
    <RelationList
      className="astra-detail__relations"
      title="Decision dependencies"
      empty="None"
      description="Records this output depends on."
      items={analysisRoot.decisions.slice(0, 3).map((decision) => ({
        key: decision.ref,
        label: decision.label ?? decision.ref,
        identifier: decision.ref,
        kind: 'decision' as const,
        onOpen: noop,
      }))}
    />
    <RelationList
      className="astra-detail__relations"
      title="Static relations"
      empty="None"
      items={analysisRoot.inputs.slice(0, 2).map((input) => ({
        key: input.ref,
        label: input.label ?? input.ref,
        detail: input.path,
        kind: 'input' as const,
      }))}
    />
    <CountHeading title="Count heading" count={12} />
  </div>
);
