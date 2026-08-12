import { useEffect, useMemo, useState } from 'react';
import {
  type OutputRecordView,
  type ResourceDescriptor,
} from '@astra-spec/sdk/view-model';
import type {
  ResourcePreview,
  RuntimeOverlayV1,
  ViewerHost,
} from './viewer-types.js';
import { passiveViewerHost, useOptionalAstraViewer } from './context.js';
import { projectIndex, type ModelInput } from './shared.js';
import { Badge, Button, SurfaceHeader } from './ui.js';

export interface ArtifactPreviewProps {
  preview: ResourcePreview;
  resource?: ResourceDescriptor;
}

export function ArtifactPreview({ preview, resource }: ArtifactPreviewProps) {
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

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: ResourcePreview }
  | { status: 'error'; message: string };

export interface ResultViewerProps {
  output: OutputRecordView;
  model?: ModelInput;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
}

export function ResultViewer({ output, model, runtime, host }: ResultViewerProps) {
  const context = useOptionalAstraViewer();
  const resolvedRuntime = runtime ?? context?.runtime;
  const resolvedHost = host ?? context?.host ?? passiveViewerHost;
  const index = useMemo(
    () => model ? projectIndex(model, resolvedRuntime) : context?.index,
    [context?.index, model, resolvedRuntime],
  );
  const materialization = resolvedRuntime?.outputs[output.id];
  const ids = materialization?.resourceIds.length
    ? materialization.resourceIds
    : output.resourceIds;
  const resource = ids.map((id) => index?.resourceById.get(id)).find(Boolean);
  const missingReason = materialization?.message
    ?? index?.model.diagnostics.find((diagnostic) =>
      diagnostic.code === 'missing_expected_result'
      && diagnostic.canonicalPath === output.canonicalPath
    )?.message;
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    if (output.metric?.value !== undefined) {
      setState({
        status: 'ready',
        preview: {
          kind: 'metric',
          value: output.metric.value,
          ...(output.metric.uncertainty !== undefined
            ? { uncertainty: output.metric.uncertainty }
            : {}),
          ...(output.metric.unit ? { unit: output.metric.unit } : {}),
          ...(output.metric.label ? { label: output.metric.label } : {}),
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
      setState({ status: 'ready', preview: { kind: 'unavailable', reason: 'This host does not provide result previews.' } });
      return () => { active = false; };
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    void resolvedHost.getPreview(resource.id, {
      maxRows: 50,
      maxColumns: 30,
      maxBytes: 512_000,
      signal: controller.signal,
    }).then((preview) => {
      if (active) setState({ status: 'ready', preview });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load result preview.',
        });
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    output.metric,
    missingReason,
    resource?.id,
    resource?.revision,
    resolvedHost,
    resolvedRuntime?.materializationRevision,
  ]);

  const status = materialization?.status ?? resource?.availability ?? 'unknown';
  return (
    <section className="astra-result-viewer" aria-label="Result preview">
      <SurfaceHeader
        className="astra-result-viewer__header"
        density="inline"
        eyebrow={<Badge status={status}>{status}</Badge>}
        identifier={resource?.fileName}
        actions={resource && resolvedHost.getDownloadUrl ? (
          <Button
            className="astra-result-viewer__download"
            onClick={() => {
              void resolvedHost.getDownloadUrl!(resource.id).then((url) => {
                if (resolvedHost.openExternal) resolvedHost.openExternal(url);
              });
            }}
          >
            Open result
          </Button>
        ) : null}
      />
      {state.status === 'loading' ? <p className="astra-muted" aria-live="polite">Loading the latest result…</p> : null}
      {state.status === 'error' ? <p className="astra-error" role="alert">{state.message}</p> : null}
      {state.status === 'ready' ? <ArtifactPreview preview={state.preview} {...(resource ? { resource } : {})} /> : null}
    </section>
  );
}
