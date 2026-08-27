import type { ResolvedOutput } from '@astra-spec/sdk';
import { useEffect, useState, type ReactNode } from 'react';

export interface TablePreviewData {
  kind: 'table';
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
  totalRows?: number;
  totalColumns?: number;
  truncated?: boolean;
}

export interface ImagePreviewData {
  kind: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface MetricPreviewData {
  kind: 'metric';
  value: number | string;
  uncertainty?: number | string;
  unit?: string;
  label?: string;
}

export interface TextPreviewData {
  kind: 'text';
  text: string;
  language?: string;
  truncated?: boolean;
}

export interface UnavailablePreviewData {
  kind: 'unavailable';
  reason?: string;
}

/** Host-safe data that a portable component can render without reading a file. */
export type ArtifactPreviewData =
  | TablePreviewData
  | ImagePreviewData
  | MetricPreviewData
  | TextPreviewData
  | UnavailablePreviewData;

export interface ArtifactRenderOptions {
  compact: boolean;
}

/** Controlled host slot. Reading, decoding, URLs, and caching remain outside astra-ui. */
export type ArtifactRenderer = (
  output: ResolvedOutput,
  options: ArtifactRenderOptions,
) => ReactNode;

export interface ArtifactPreviewProps {
  output: ResolvedOutput;
  preview?: ArtifactPreviewData | undefined;
  compact?: boolean | undefined;
  caption?: ReactNode | undefined;
  className?: string | undefined;
}

function compactValue(value: string | number | undefined): string {
  if (value == null || value === '') return 'Value unavailable';
  return typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumSignificantDigits: 5 })
    : value;
}

function unavailableReason(output: ResolvedOutput): string {
  if (!output.active) return 'This output is not active in the selected universe.';
  if (!output.artifact) return 'This output has not been materialized.';
  return 'This host has not supplied an artifact preview.';
}

/** Pure renderer for a resolved output and optional host-supplied preview data. */
export function ArtifactPreview({
  output,
  preview,
  compact = false,
  caption = output.label ?? output.id,
  className,
}: ArtifactPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = preview?.kind === 'image' ? preview.url : undefined;
  useEffect(() => setImageFailed(false), [imageUrl, output.canonicalPath]);
  const classes = [
    'astra-artifact',
    `astra-artifact--${preview?.kind ?? output.type}`,
    compact ? 'is-compact' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  if (!preview || preview.kind === 'unavailable') {
    return (
      <div className={`${classes} inventory-output-preview__placeholder`} role="status">
        <span aria-hidden="true">{output.active ? '↳' : '○'}</span>
        <span>{preview?.reason ?? unavailableReason(output)}</span>
      </div>
    );
  }

  if (preview.kind === 'image') {
    if (imageFailed) {
      return (
        <div className={`${classes} inventory-output-preview__placeholder`} role="status">
          <span aria-hidden="true">▦</span>
          <span>Figure preview unavailable</span>
        </div>
      );
    }
    return (
      <figure className={classes}>
        <img
          src={preview.url}
          alt={preview.alt ?? `Preview of ${output.label ?? output.id}`}
          width={preview.width}
          height={preview.height}
          onError={() => setImageFailed(true)}
        />
        {!compact && caption != null ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  }

  if (preview.kind === 'table') {
    const columnLimit = compact ? 5 : 30;
    const rowLimit = compact ? 4 : 30;
    const headers = preview.headers.slice(0, columnLimit);
    const rows = preview.rows.slice(0, rowLimit);
    const totalRows = preview.totalRows ?? preview.rows.length;
    const totalColumns = preview.totalColumns ?? preview.headers.length;
    return (
      <div className={`${classes} inventory-output-table`} tabIndex={0}>
        <table>
          <thead>
            <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.slice(0, columnLimit).map((cell, columnIndex) => (
                  <td key={columnIndex}>{cell === null ? '—' : String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!compact && (
          preview.truncated
          || totalRows > rows.length
          || totalColumns > headers.length
        ) ? (
          <p>Showing {rows.length} of {totalRows} rows and {headers.length} of {totalColumns} columns.</p>
        ) : null}
      </div>
    );
  }

  if (preview.kind === 'metric') {
    return (
      <div className={`${classes} inventory-output-metric`}>
        {preview.label ? <span>{preview.label}</span> : null}
        <strong className="inventory-output-metric__value">{compactValue(preview.value)}</strong>
        {preview.uncertainty !== undefined ? (
          <span className="inventory-output-metric__uncertainty">± {preview.uncertainty}</span>
        ) : null}
        {preview.unit ? <span className="inventory-output-metric__unit">{preview.unit}</span> : null}
      </div>
    );
  }

  return (
    <div className={classes}>
      <pre><code>{preview.text}</code></pre>
      {preview.truncated ? <p>Preview truncated.</p> : null}
    </div>
  );
}
