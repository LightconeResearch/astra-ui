import type { ResolvedOutput } from '@astra-spec/sdk';
import {
  metricPreviewFromJson,
  tablePreviewFromDelimited,
  tablePreviewFromRows,
  type ArtifactPreviewData,
} from './preview-data.js';

/**
 * One artifact's bytes, wherever the host keeps them. The package reads
 * nothing itself: `readText` is the host's own I/O, asked for a bounded
 * prefix, so a preview never costs a whole large file.
 */
export interface ArtifactSource {
  /** Where the bytes are served, for an image preview. */
  url: string;
  /** Size of the bytes; `null` when unknown. */
  size: number | null;
  /** Alternative text for an image preview. */
  alt?: string | undefined;
  /** Read at most `maxBytes` as text, saying whether the limit cut it. */
  readText(maxBytes: number, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }>;
}

const IMAGE_FORMATS: ReadonlySet<string> = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const DELIMITERS: ReadonlyMap<string, string> = new Map([
  ['csv', ','],
  ['tsv', '\t'],
]);
/** How much of a delimited table is read for its preview. */
const TABLE_SAMPLE_BYTES = 65_536;
/** JSON artifacts larger than this are not parsed for a preview. */
const JSON_MAX_BYTES = 2_000_000;

const unavailable = (reason: string): ArtifactPreviewData => ({ kind: 'unavailable', reason });

const isRow = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Bounded preview data for an output's bytes: a figure in an image format as
 * an image, a delimited table from a 64 KiB sample, a JSON table or metric
 * parsed under 2 MB; anything else unavailable, with the reason. Hosts that
 * share it preview the same output the same way.
 */
export async function artifactPreviewFromSource(
  output: ResolvedOutput,
  source: ArtifactSource,
  signal?: AbortSignal,
): Promise<ArtifactPreviewData> {
  const format = (output.format ?? '').replace(/^\./, '').toLowerCase();
  if (output.type === 'figure' && IMAGE_FORMATS.has(format)) {
    return { kind: 'image', url: source.url, ...(source.alt === undefined ? {} : { alt: source.alt }) };
  }
  const delimiter = DELIMITERS.get(format);
  if (output.type === 'table' && delimiter !== undefined) {
    const sample = await source.readText(TABLE_SAMPLE_BYTES, signal);
    return tablePreviewFromDelimited(sample.text, { delimiter, sourceTruncated: sample.truncated });
  }
  if ((output.type === 'table' || output.type === 'metric') && format === 'json') {
    const tooLarge = unavailable('The JSON artifact exceeds the preview limit.');
    if (source.size !== null && source.size > JSON_MAX_BYTES) return tooLarge;
    const sample = await source.readText(JSON_MAX_BYTES, signal);
    if (sample.truncated) return tooLarge;
    let value: unknown;
    try {
      value = JSON.parse(sample.text);
    } catch (error) {
      // Only a parse failure means the bytes are not JSON.
      if (!(error instanceof SyntaxError)) throw error;
    }
    const data =
      output.type === 'metric'
        ? metricPreviewFromJson(value)
        : Array.isArray(value) && value.every(isRow)
          ? tablePreviewFromRows(value)
          : undefined;
    return data ?? unavailable(`The file is not a JSON ${output.type}.`);
  }
  return unavailable(
    format ? `No bounded preview is available for .${format} artifacts.` : 'This output does not declare an artifact format.',
  );
}
