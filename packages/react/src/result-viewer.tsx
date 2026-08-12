import {
  type OutputRecordView,
} from '@astra-spec/sdk/view-model';
import type {
  RuntimeOverlayV1,
  ViewerHost,
} from './viewer-types.js';
import { passiveViewerHost, useOptionalAstraViewer } from './context.js';
import { type ModelInput } from './shared.js';
import { ArtifactPreview, useResourcePreview } from './artifact-preview.js';
import { Badge, Button, SurfaceHeader } from './ui.js';

export interface ResultViewerProps {
  output: OutputRecordView;
  model?: ModelInput;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
}

export function ResultViewer({ output, model, runtime, host }: ResultViewerProps) {
  const context = useOptionalAstraViewer();
  const resolvedHost = host ?? context?.host ?? passiveViewerHost;
  const { state, resource, status } = useResourcePreview({
    output,
    ...(model ? { model } : {}),
    ...(runtime ? { runtime } : {}),
    host: resolvedHost,
  });
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
