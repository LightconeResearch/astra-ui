import { useEffect, useMemo, useState } from 'react';
import type {
  OutputRecordView,
  ResourceDescriptor,
} from '@astra-spec/sdk/view-model';
import { passiveViewerHost, useOptionalAstraViewer } from './context.js';
import { projectIndex, type ModelInput } from './shared.js';
import type {
  OutputMaterialization,
  ResourcePreview,
  RuntimeOverlayV1,
  ViewerHost,
} from './viewer-types.js';

const DEFAULT_PREVIEW_ROWS = 50;
const DEFAULT_PREVIEW_COLUMNS = 30;
const DEFAULT_PREVIEW_BYTES = 512_000;

export type ResourcePreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: ResourcePreview }
  | { status: 'error'; message: string };

export interface UseResourcePreviewOptions {
  output: OutputRecordView;
  model?: ModelInput;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  maxRows?: number;
  maxColumns?: number;
  maxBytes?: number;
}

export interface ResourcePreviewResult {
  output: OutputRecordView;
  state: ResourcePreviewState;
  resource?: ResourceDescriptor;
  materialization?: OutputMaterialization;
  missingReason?: string;
  status: string;
}

/** Resolve and load an output preview once, independent of its presentation. */
export function useResourcePreview({
  output,
  model,
  runtime,
  host,
  maxRows = DEFAULT_PREVIEW_ROWS,
  maxColumns = DEFAULT_PREVIEW_COLUMNS,
  maxBytes = DEFAULT_PREVIEW_BYTES,
}: UseResourcePreviewOptions): ResourcePreviewResult {
  const context = useOptionalAstraViewer();
  const resolvedRuntime = runtime ?? context?.runtime;
  const resolvedHost = host ?? context?.host ?? passiveViewerHost;
  const index = useMemo(
    () => model ? projectIndex(model, resolvedRuntime) : context?.index,
    [context?.index, model, resolvedRuntime],
  );
  const indexedOutput = index?.recordById.get(output.id);
  const resolvedOutput = indexedOutput?.kind === 'output' ? indexedOutput : output;
  const materialization = resolvedRuntime?.outputs[resolvedOutput.id];
  const resourceIds = materialization?.resourceIds.length
    ? materialization.resourceIds
    : resolvedOutput.resourceIds;
  const resource = resourceIds
    .map((resourceId) => index?.resourceById.get(resourceId))
    .find((candidate): candidate is ResourceDescriptor => Boolean(candidate));
  const missingReason = materialization?.message
    ?? index?.model.diagnostics.find((diagnostic) =>
      diagnostic.code === 'missing_expected_result'
      && diagnostic.canonicalPath === resolvedOutput.canonicalPath
    )?.message;
  const [state, setState] = useState<ResourcePreviewState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    if (resolvedOutput.metric?.value !== undefined) {
      setState({
        status: 'ready',
        preview: {
          kind: 'metric',
          value: resolvedOutput.metric.value,
          ...(resolvedOutput.metric.uncertainty !== undefined
            ? { uncertainty: resolvedOutput.metric.uncertainty }
            : {}),
          ...(resolvedOutput.metric.unit ? { unit: resolvedOutput.metric.unit } : {}),
          ...(resolvedOutput.metric.label ? { label: resolvedOutput.metric.label } : {}),
        },
      });
      return () => { active = false; };
    }
    if (!resource) {
      setState({
        status: 'ready',
        preview: {
          kind: 'unavailable',
          reason: missingReason ?? 'This output has no materialized resource.',
        },
      });
      return () => { active = false; };
    }
    if (!resolvedHost.getPreview) {
      setState({
        status: 'ready',
        preview: {
          kind: 'unavailable',
          reason: 'This host does not provide result previews.',
        },
      });
      return () => { active = false; };
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    void resolvedHost.getPreview(resource.id, {
      maxRows,
      maxColumns,
      maxBytes,
      signal: controller.signal,
    }).then((preview) => {
      if (active) setState({ status: 'ready', preview });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        setState({
          status: 'error',
          message: error instanceof Error
            ? error.message
            : 'Could not load result preview.',
        });
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    maxBytes,
    maxColumns,
    maxRows,
    missingReason,
    resolvedHost,
    resolvedOutput.metric,
    resource?.id,
    resource?.revision,
    resolvedRuntime?.materializationRevision,
  ]);

  return {
    output: resolvedOutput,
    state,
    ...(resource ? { resource } : {}),
    ...(materialization ? { materialization } : {}),
    ...(missingReason ? { missingReason } : {}),
    status: materialization?.status ?? resource?.availability ?? 'unknown',
  };
}

export function inventoryFileName(output: OutputRecordView): string {
  return output.localId;
}

export function inventoryFileExtension(output: OutputRecordView): string {
  const name = inventoryFileName(output);
  const dot = name.lastIndexOf('.');
  return dot > 0
    ? name.slice(dot + 1).toUpperCase()
    : output.outputType.toUpperCase();
}

function compactValue(value: string | number | undefined): string {
  if (value == null || value === '') return 'Value unavailable';
  return typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumSignificantDigits: 5 })
    : value;
}

export type ArtifactPreviewProps =
  | {
      variant?: 'standard';
      preview: ResourcePreview;
      resource?: ResourceDescriptor;
    }
  | {
      variant: 'inventory';
      output: OutputRecordView;
      preview?: ResourcePreview;
      resource?: ResourceDescriptor;
      compact?: boolean;
    };

/** The sole renderer for host-safe artifact preview values. */
export function ArtifactPreview(props: ArtifactPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (props.variant === 'inventory') {
    const { output, preview, resource, compact = false } = props;
    if (preview?.kind === 'unavailable' && preview.reason) {
      return (
        <div className="inventory-output-preview__placeholder" role="alert">
          <span aria-hidden="true">!</span>
          <span>{preview.reason}</span>
        </div>
      );
    }
    if (output.outputType === 'figure') {
      const previewUrl = preview?.kind === 'image' ? preview.url : undefined;
      if (!previewUrl || imageFailed) {
        return (
          <div className="inventory-output-preview__placeholder" aria-label="Figure preview unavailable">
            <span aria-hidden="true">▦</span>
            <span>Figure preview unavailable</span>
          </div>
        );
      }
      return (
        <img
          src={previewUrl}
          alt={`Preview of ${output.label ?? output.localId}`}
          onError={() => setImageFailed(true)}
        />
      );
    }
    if (output.outputType === 'table') {
      const table = preview?.kind === 'table' ? preview : undefined;
      if (!table?.headers.length) {
        return (
          <div className="inventory-output-preview__placeholder" aria-label="Table preview unavailable">
            <span aria-hidden="true">▤</span>
            <span>Table preview unavailable</span>
          </div>
        );
      }
      const columnLimit = compact ? 5 : 30;
      const rowLimit = compact ? 4 : 30;
      const headers = table.headers.slice(0, columnLimit);
      const rows = table.rows.slice(0, rowLimit);
      const totalRows = table.totalRows ?? table.rows.length;
      const totalColumns = table.totalColumns ?? table.headers.length;
      return (
        <div className={`inventory-output-table${compact ? ' is-compact' : ''}`}>
          <table>
            <thead>
              <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.slice(0, columnLimit).map((value, columnIndex) => (
                    <td key={columnIndex}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!compact && (totalRows > rows.length || totalColumns > headers.length) ? (
            <p>
              Showing {rows.length} of {totalRows} rows and{' '}
              {headers.length} of {totalColumns} columns.
            </p>
          ) : null}
        </div>
      );
    }
    if (output.outputType === 'metric') {
      const metric = preview?.kind === 'metric' ? preview : output.metric;
      return (
        <div className="inventory-output-metric">
          <span className="inventory-output-metric__value">{compactValue(metric?.value)}</span>
          {metric?.uncertainty != null ? (
            <span className="inventory-output-metric__uncertainty">± {metric.uncertainty}</span>
          ) : null}
          {metric?.unit ? <span className="inventory-output-metric__unit">{metric.unit}</span> : null}
        </div>
      );
    }
    const fileName = resource?.fileName ?? inventoryFileName(output);
    const dot = fileName.lastIndexOf('.');
    const fileType = dot > 0
      ? fileName.slice(dot + 1).toUpperCase()
      : inventoryFileExtension(output);
    return (
      <div className="inventory-output-file-hero">
        <span aria-hidden="true">↳</span>
        <strong>{fileName}</strong>
        <small>{fileType}</small>
      </div>
    );
  }

  const { preview, resource } = props;
  if (preview.kind === 'image') {
    return (
      <figure className="astra-artifact astra-artifact--image">
        <img src={preview.url} alt={preview.alt ?? resource?.fileName ?? 'ASTRA result'} />
        {resource?.fileName ? <figcaption>{resource.fileName}</figcaption> : null}
      </figure>
    );
  }
  if (preview.kind === 'table') {
    return (
      <div className="astra-artifact astra-artifact--table" tabIndex={0}>
        <table>
          <thead>
            <tr>{preview.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => <td key={columnIndex}>{cell === null ? '—' : String(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {preview.truncated ? <p className="astra-muted">Preview truncated.</p> : null}
      </div>
    );
  }
  if (preview.kind === 'metric') {
    return (
      <div className="astra-artifact astra-artifact--metric">
        {preview.label ? <span>{preview.label}</span> : null}
        <strong>{preview.value}</strong>
        {preview.uncertainty !== undefined ? <span> ± {preview.uncertainty}</span> : null}
        {preview.unit ? <span> {preview.unit}</span> : null}
      </div>
    );
  }
  if (preview.kind === 'text') {
    return (
      <div className="astra-artifact astra-artifact--text">
        <pre><code>{preview.text}</code></pre>
        {preview.truncated ? <p className="astra-muted">Preview truncated.</p> : null}
      </div>
    );
  }
  return (
    <div className="astra-artifact astra-artifact--unavailable">
      <p>{preview.reason ?? 'No preview is available for this result.'}</p>
    </div>
  );
}
