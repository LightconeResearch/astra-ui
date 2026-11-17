// The browser host loads resources; astra-ui only renders reports and safe previews.
import {
  indexResolvedAnalysis,
  parseResolvedAnalysis,
  parseStatusReport,
  selectResult,
  type Output,
  type Result,
  type ProvenanceRecord,
} from '@astra-spec/sdk/reports';
import { ArtifactPreview, type ArtifactRenderer } from '@astra-spec/ui/components';
import { tablePreviewFromDelimited, metricPreviewFromJson, type ArtifactPreviewData } from '@astra-spec/ui/lib';
import { useEffect, useState } from 'react';
import fixture from '../fixtures/desi.json';

export interface FixtureArtifact {
  url: string;
  path: string;
  format: string;
}
export const analysisDocument = parseResolvedAnalysis(fixture.document);
export const analysisRoot = (() => {
  const analysis = analysisDocument.analyses.find((candidate) => candidate.key === '');
  if (!analysis) throw new Error('Fixture root missing');
  return analysis;
})();
export const statusReport = parseStatusReport(fixture.status);
export const index = indexResolvedAnalysis(analysisDocument);
export const defaultUniverse = analysisDocument.analyses[0]?.universes[0]?.ref;
const artifacts: Record<string, FixtureArtifact> = Object.fromEntries(
  Object.entries(fixture.artifacts).map(([id, artifact]) => [
    id,
    { ...artifact, url: `${import.meta.env.BASE_URL}${artifact.url.replace(/^\//, '')}` },
  ]),
);
function fixtureResult(output: Output): Result | undefined {
  return defaultUniverse
    ? selectResult(index, output.ref, defaultUniverse)
    : index.resultsByOutput.get(output.ref)?.find((result) => result.universe === undefined);
}
export function fixtureArtifact(output: Output): FixtureArtifact | undefined {
  const result = fixtureResult(output);
  return result ? artifacts[result.id] : undefined;
}
const imageFormats = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp']);
const previewCache = new Map<string, Promise<ArtifactPreviewData>>();
function loadPreview(output: Output, result: Result | undefined): Promise<ArtifactPreviewData> {
  const artifact = result ? artifacts[result.id] : undefined;
  if (!artifact || !result) return Promise.resolve({ kind: 'unavailable' });
  let pending = previewCache.get(result.id);
  if (!pending) {
    pending = imageFormats.has(artifact.format)
      ? Promise.resolve({ kind: 'image', url: artifact.url, alt: output.label ?? output.ref })
      : fetch(artifact.url)
          .then((response) => {
            if (!response.ok) throw new Error('Resource unavailable');
            return response.text();
          })
          .then((text) =>
            artifact.format === 'csv' || artifact.format === 'tsv'
              ? tablePreviewFromDelimited(text, { delimiter: artifact.format === 'tsv' ? '\t' : ',' })
              : artifact.format === 'json'
                ? (metricPreviewFromJson(JSON.parse(text)) ?? { kind: 'text', text })
                : { kind: 'text', text },
          );
    previewCache.set(result.id, pending);
  }
  return pending;
}
function HostArtifactPreview({
  output,
  compact,
  result = fixtureResult(output),
}: {
  output: Output;
  compact: boolean;
  result?: Result | undefined;
}) {
  const [preview, setPreview] = useState<ArtifactPreviewData | undefined>();
  useEffect(() => {
    let cancelled = false;
    setPreview(undefined);
    void loadPreview(output, result).then(
      (data) => {
        if (!cancelled) setPreview(data);
      },
      () => {
        if (!cancelled) setPreview({ kind: 'unavailable', reason: 'Resource unavailable' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [output, result]);
  return (
    <ArtifactPreview
      output={output}
      result={result}
      status={result ? statusReport.statuses[result.id] : undefined}
      preview={preview}
      compact={compact}
    />
  );
}
export const renderArtifact: ArtifactRenderer = (output, { compact, result, universeRef }) => {
  const selected = result ?? (universeRef === undefined ? fixtureResult(output) : undefined);
  return selected && artifacts[selected.id] ? (
    <HostArtifactPreview output={output} result={selected} compact={compact} />
  ) : null;
};
export const paperMetadata = {
  '10.48550/arxiv.2404.03000': {
    title: 'DESI 2024 III: Baryon Acoustic Oscillations from Galaxies and Quasars',
    authors: 'DESI Collaboration',
  },
};
/** A clearly synthetic record used only in provenance component stories. */
export const sampleRun: ProvenanceRecord = {
  address: 'outputs.bao_fit_plot#baseline',
  spec_version: '0.1.0',
  content_hash: 'sha256:example',
  size: 128,
  generated_by: {
    finished: '2026-08-30T14:22:00Z',
    commit: 'a1b2c3d4e5f678901234567890abcdef12345678',
    environment: { iri: 'oci:example/environment' },
    inputs: [{ entry: 'inputs.catalog', content_hash: 'sha256:example-input', size: 64 }],
    runner: { id: 'example-runner', version: '0.4.2' },
  },
};
export { loadPdfJs } from './pdf-runtime';
