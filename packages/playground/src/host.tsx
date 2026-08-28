// The playground plays the role of a host: it decodes artifacts into
// host-safe preview data and hands them to astra-ui through render slots.
import type { ResolvedAnalysisDocument, ResolvedOutput } from '@astra-spec/sdk';
import {
  ArtifactPreview,
  type ArtifactPreviewData,
  type ArtifactRenderer,
} from '@lightcone-research/astra-ui/components';
import { useEffect, useState } from 'react';
import fixture from '../fixtures/desi.json';

export interface FixtureArtifact {
  url: string;
  path: string;
  format: string;
}

export const analysisDocument = fixture.document as unknown as ResolvedAnalysisDocument;
export const artifacts = fixture.artifacts as Record<string, FixtureArtifact>;

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
    pdfUrl: '/papers/desi-2024-iii.pdf',
  },
};

export function renderPaper() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--astra-muted)' }}>
      Host paper renderer (PDF viewer would mount here)
    </div>
  );
}
