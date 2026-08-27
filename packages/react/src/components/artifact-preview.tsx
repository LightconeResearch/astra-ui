import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface TablePreviewData {
  kind: 'table';
  headers: string[];
  rows: (string | number | boolean | null)[][];
  totalRows?: number | undefined;
  totalColumns?: number | undefined;
  truncated?: boolean | undefined;
}

export interface ImagePreviewData {
  kind: 'image';
  url: string;
  alt?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface MetricPreviewData {
  kind: 'metric';
  value: number | string;
  uncertainty?: number | string | undefined;
  unit?: string | undefined;
  label?: string | undefined;
}

export interface TextPreviewData {
  kind: 'text';
  text: string;
  language?: string | undefined;
  truncated?: boolean | undefined;
}

export interface LoadingPreviewData {
  kind: 'loading';
  message?: string | undefined;
}

export interface UnavailablePreviewData {
  kind: 'unavailable';
  reason?: string | undefined;
}

/** Host-safe data that a portable component can render without reading a file. */
export type ArtifactPreviewData =
  | TablePreviewData
  | ImagePreviewData
  | MetricPreviewData
  | TextPreviewData
  | LoadingPreviewData
  | UnavailablePreviewData;

export interface ArtifactRenderOptions {
  compact: boolean;
}

/** Controlled host slot. Reading, decoding, URLs, and caching remain outside astra-ui. */
export type ArtifactRenderer = (
  output: ResolvedOutput,
  options: ArtifactRenderOptions,
) => ReactNode;

export interface ArtifactPreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  output: ResolvedOutput;
  preview?: ArtifactPreviewData | undefined;
  compact?: boolean | undefined;
  caption?: ReactNode | undefined;
  /** Pure helpers exported below build the default preview data. */
  locale?: string | undefined;
}

function compactValue(value: string | number | undefined, locale: string | undefined): string {
  if (value == null || value === '') return 'Value unavailable';
  return typeof value === 'number'
    ? value.toLocaleString(locale, { maximumSignificantDigits: 5 })
    : value;
}

function unavailableReason(output: ResolvedOutput): string {
  if (!output.active) return 'This output is not active in the selected universe.';
  if (!output.artifact) return 'This output has not been materialized.';
  return 'This host has not supplied an artifact preview.';
}

/** Pure renderer for a resolved output and optional host-supplied preview data. */
export const ArtifactPreview = forwardRef<HTMLElement, ArtifactPreviewProps>(function ArtifactPreview({
  output,
  preview,
  compact = false,
  caption = output.label ?? output.id,
  locale,
  className,
  ...props
}, ref) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = preview?.kind === 'image' ? preview.url : undefined;
  useEffect(() => { setImageFailed(false); }, [imageUrl, output.canonicalPath]);

  const type = preview?.kind ?? output.type;
  const shared = {
    ...props,
    'data-slot': 'artifact-preview',
    'data-type': type,
    ...(compact ? { 'data-compact': '' } : {}),
  };
  const rootClass = cn('astra-artifact', className);

  if (preview?.kind === 'loading') {
    return (
      <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__placeholder')} role="status" aria-busy="true">
        <span aria-hidden="true">…</span>
        <span>{preview.message ?? 'Loading preview…'}</span>
      </div>
    );
  }

  if (!preview || preview.kind === 'unavailable') {
    return (
      <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__placeholder')} role="status">
        <span aria-hidden="true">{output.active ? '↳' : '○'}</span>
        <span>{preview?.reason ?? unavailableReason(output)}</span>
      </div>
    );
  }

  if (preview.kind === 'image') {
    if (imageFailed) {
      return (
        <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__placeholder')} role="status">
          <span aria-hidden="true">▦</span>
          <span>Figure preview unavailable</span>
        </div>
      );
    }
    return (
      <figure {...shared} ref={ref} className={rootClass}>
        <img
          src={preview.url}
          alt={preview.alt ?? `Preview of ${output.label ?? output.id}`}
          width={preview.width}
          height={preview.height}
          onError={() => { setImageFailed(true); }}
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
      // The full-size table scrolls and must be keyboard-reachable; the compact one sits inside a card button.
      <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__table')} {...(compact ? {} : { tabIndex: 0 })}>
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
      <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__metric')}>
        {preview.label ? <span>{preview.label}</span> : null}
        <strong className="astra-artifact__metric-value">{compactValue(preview.value, locale)}</strong>
        {preview.uncertainty !== undefined ? (
          <span className="astra-artifact__metric-uncertainty">± {preview.uncertainty}</span>
        ) : null}
        {preview.unit ? <span className="astra-artifact__metric-unit">{preview.unit}</span> : null}
      </div>
    );
  }

  return (
    <div {...shared} ref={ref as never} className={rootClass}>
      <pre><code>{preview.text}</code></pre>
      {preview.truncated ? <p>Preview truncated.</p> : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Pure helpers hosts can use to build preview data (no I/O)            */
/* ------------------------------------------------------------------ */

export interface DelimitedPreviewOptions {
  delimiter?: string | undefined;
  maxRows?: number | undefined;
  maxColumns?: number | undefined;
  /** Set when the source text was itself cut short by the host. */
  sourceTruncated?: boolean | undefined;
}

/** RFC 4180-style rows: quoted cells may hold delimiters, doubled quotes, and line breaks. Blank rows are dropped. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => { row.push(cell.trim()); cell = ''; };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (quoted) {
      if (character !== '"') cell += character;
      else if (text.charAt(index + 1) === '"') { cell += '"'; index += 1; } else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) endCell();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text.charAt(index + 1) === '\n') index += 1;
      endRow();
    } else cell += character;
  }
  endRow();
  return rows;
}

/** Turns delimited text (CSV, TSV) into table preview data. */
export function tablePreviewFromDelimited(text: string, options: DelimitedPreviewOptions = {}): TablePreviewData {
  const delimiter = options.delimiter ?? ',';
  const maxRows = options.maxRows ?? 30;
  const maxColumns = options.maxColumns ?? 30;
  const [allHeaders = [], ...body] = parseDelimited(text, delimiter);
  const headers = allHeaders.slice(0, maxColumns);
  const rows = body.slice(0, maxRows).map((cells) => cells.slice(0, maxColumns));
  return {
    kind: 'table',
    headers,
    rows,
    totalRows: body.length,
    totalColumns: allHeaders.length,
    truncated: Boolean(options.sourceTruncated) || body.length > maxRows || allHeaders.length > maxColumns,
  };
}

/** Turns an array of flat objects (e.g. parsed JSON records) into table preview data. */
export function tablePreviewFromRows(
  records: readonly Record<string, unknown>[],
  options: Pick<DelimitedPreviewOptions, 'maxRows' | 'maxColumns' | 'sourceTruncated'> = {},
): TablePreviewData {
  const maxRows = options.maxRows ?? 30;
  const maxColumns = options.maxColumns ?? 30;
  const allHeaders = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const headers = allHeaders.slice(0, maxColumns);
  const rows = records.slice(0, maxRows).map((record) => headers.map((header) => {
    const value = record[header];
    if (value == null) return null;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
    return JSON.stringify(value);
  }));
  return {
    kind: 'table',
    headers,
    rows,
    totalRows: records.length,
    totalColumns: allHeaders.length,
    truncated: Boolean(options.sourceTruncated) || records.length > maxRows || allHeaders.length > maxColumns,
  };
}

/** Reads a metric from a scalar or a `{ value, uncertainty?, unit?, label? }` object; `undefined` when the shape is not a metric. */
export function metricPreviewFromJson(value: unknown): MetricPreviewData | undefined {
  if (typeof value === 'number' || typeof value === 'string') return { kind: 'metric', value };
  if (value && typeof value === 'object' && 'value' in value) {
    const record = value as Record<string, unknown>;
    const metric = record.value;
    if (typeof metric !== 'number' && typeof metric !== 'string') return undefined;
    const result: MetricPreviewData = { kind: 'metric', value: metric };
    if (typeof record.uncertainty === 'number' || typeof record.uncertainty === 'string') result.uncertainty = record.uncertainty;
    if (typeof record.unit === 'string') result.unit = record.unit;
    if (typeof record.label === 'string') result.label = record.label;
    return result;
  }
  return undefined;
}
