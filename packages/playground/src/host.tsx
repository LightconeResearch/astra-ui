// The playground plays the role of a host: it decodes artifacts into
// host-safe preview data and hands them to astra-ui through render slots.
import type { ResolvedAnalysisDocument, ResolvedOutput } from '@astra-spec/sdk';
import { ArtifactPreview, OutputProvenance, type ArtifactRenderer } from '@astra-spec/ui/components';
import type { ArtifactPreviewData, OutputRun, OutputStatus, OutputStatusLookup } from '@astra-spec/ui/lib';
import { useEffect, useState } from 'react';
import fixture from '../fixtures/desi.json';

export interface FixtureArtifact {
  url: string;
  path: string;
  format: string;
}

export const analysisDocument = fixture.document as unknown as ResolvedAnalysisDocument;
export const artifacts: Record<string, FixtureArtifact> = Object.fromEntries(
  Object.entries(fixture.artifacts).map(([path, artifact]) => [path, {
    ...artifact,
    url: `${import.meta.env.BASE_URL}${artifact.url.replace(/^\//, '')}`,
  }]),
);

const IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp']);

function parseCsv(text: string, maxRows = 40): Extract<ArtifactPreviewData, { kind: 'table' }> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  const [head = '', ...body] = lines;
  const headers = head.split(',').map((cell) => cell.trim());
  const rows = body.slice(0, maxRows).map((line) => line.split(',').map((cell) => cell.trim()));
  return {
    kind: 'table',
    headers,
    rows,
    totalRows: body.length,
    totalColumns: headers.length,
    truncated: body.length > maxRows,
  };
}

const previewCache = new Map<string, Promise<ArtifactPreviewData>>();

function loadPreview(output: ResolvedOutput): Promise<ArtifactPreviewData> {
  const artifact = artifacts[output.canonicalPath];
  if (!artifact) return Promise.resolve({ kind: 'unavailable' });
  let pending = previewCache.get(output.canonicalPath);
  if (!pending) {
    pending = IMAGE_FORMATS.has(artifact.format)
      ? Promise.resolve({ kind: 'image', url: artifact.url, alt: output.label ?? output.id })
      : artifact.format === 'csv'
        ? fetch(artifact.url).then((response) => response.text()).then((text) => parseCsv(text))
        : Promise.resolve({ kind: 'unavailable', reason: `No preview for .${artifact.format} artifacts.` });
    previewCache.set(output.canonicalPath, pending);
  }
  return pending;
}

export function HostArtifactPreview({ output, compact }: { output: ResolvedOutput; compact: boolean }) {
  const [preview, setPreview] = useState<ArtifactPreviewData | undefined>();
  useEffect(() => {
    let cancelled = false;
    void loadPreview(output).then((data) => { if (!cancelled) setPreview(data); });
    return () => { cancelled = true; };
  }, [output]);
  return <ArtifactPreview output={output} preview={preview} compact={compact} />;
}

export const renderArtifact: ArtifactRenderer = (output, { compact }) => (
  artifacts[output.canonicalPath] ? <HostArtifactPreview output={output} compact={compact} /> : null
);

export const paperMetadata = {
  '10.48550/arxiv.2404.03000': {
    title: 'DESI 2024 III: Baryon Acoustic Oscillations from Galaxies and Quasars',
    authors: 'DESI Collaboration',
  },
};

// A handful of fixture outputs stand in for the host's execution status, so
// the playground exercises every marker and every Provenance state.
const outputStatuses: Record<string, OutputStatus> = {
  'outputs.bao_fit_plot': { state: 'outdated', detail: 'Catalogue reprocessed since this figure was generated.' },
  'outputs.bao_distance_table': { state: 'unmaterialized' },
  'outputs.xi_pre_recon_bgs': { state: 'unmaterialized', detail: 'Awaiting the next pipeline run.' },
};

export const getOutputStatus: OutputStatusLookup = (output) => outputStatuses[output.canonicalPath];

export const sampleRun: OutputRun = {
  finishedAt: '2026-08-30T14:22:00Z',
  gitRevision: 'a1b2c3d4e5f678901234567890abcdef12345678',
  recipe: 'python fit_bao.py --config configs/bao.yaml --tracer BGS',
  environment: 'sha256:9f1c2e7b0a3d4f5e6c7b8a9d0e1f2a3b4c5d6e7f',
  inputVersions: { 'catalogue.fits': 'sha256:71ad9e2c…', 'randoms.fits': 'sha256:9be0f3a1…' },
  cliVersion: 'astra-cli 0.4.2',
};

/** Recorded execution metadata below Recipe in output details, keyed off the same fixture statuses. */
export const renderProvenance = (output: ResolvedOutput) => {
  const status = outputStatuses[output.canonicalPath] ?? { state: 'materialized' };
  return <OutputProvenance status={status} run={status.state === 'unmaterialized' ? null : sampleRun} />;
};

export { loadPdfJs } from './pdf-runtime';
