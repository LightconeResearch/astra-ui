import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import type { ArtifactPreviewData } from '../lib/preview-data.js';

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
  /** Builders in `lib/preview-data` produce this from data the host already loaded. */
  locale?: string | undefined;
}

/** Numbers are rounded for display; strings are the host's exact choice and pass through. */
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
    const totalRows = preview.totalRows;
    const totalColumns = preview.totalColumns ?? preview.headers.length;
    const moreRows = totalRows === undefined ? Boolean(preview.truncated) : totalRows > rows.length;
    const moreColumns = totalColumns > headers.length;
    const rowsNote = totalRows === undefined
      ? `the first ${rows.length} rows (total unknown)`
      : `${rows.length} of ${totalRows} rows`;
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
        {!compact && (preview.truncated || moreRows || moreColumns) ? (
          <p>Showing {rowsNote} and {headers.length} of {totalColumns} columns.</p>
        ) : null}
      </div>
    );
  }

  if (preview.kind === 'metric') {
    return (
      <div {...shared} ref={ref as never} className={cn(rootClass, 'astra-artifact__metric')}>
        {preview.label ? <span className="astra-artifact__metric-label">{preview.label}</span> : null}
        <strong className="astra-artifact__metric-value">{compactValue(preview.value, locale)}</strong>
        {preview.uncertainty != null && preview.uncertainty !== '' ? (
          <span className="astra-artifact__metric-uncertainty">± {compactValue(preview.uncertainty, locale)}</span>
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

