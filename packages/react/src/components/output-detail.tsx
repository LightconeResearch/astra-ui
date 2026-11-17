import { OutputProvenance } from './output-provenance.js';
import type { OutputContext } from '../model/output-status.js';
import type { Output, Result, Status } from '@astra-spec/sdk/reports';
import { forwardRef, useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import type { OutputRelations } from '../model/relations.js';
import { isVisualOutput, recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { ArtifactPreview, type ArtifactRenderer } from './artifact-preview.js';
import { DialogAction, useDialogDismissGuard, useOptionalDialog } from '../primitives/dialog.js';
import { Prose } from '../primitives/prose.js';
import type { TextRenderer } from '../lib/prose.js';
import { RelationList } from '../primitives/relation-list.js';
import { relationItemsForLinks } from './relation-items.js';
import { FigureZoom } from './figure-zoom.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

export interface OutputPreviewProps {
  output: Output;
  result?: Result | undefined;
  status?: Status | undefined;
  universeRef?: string | undefined;
  compact?: boolean | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
}

/** The host's artifact renderer, or the built-in placeholder preview. */
export function OutputPreview({
  output,
  result,
  status,
  universeRef,
  compact = false,
  renderArtifact,
}: OutputPreviewProps) {
  return renderArtifact ? (
    <>{renderArtifact(output, { compact, result, status, universeRef })}</>
  ) : (
    <ArtifactPreview output={output} result={result} status={status} compact={compact} />
  );
}

/**
 * What the detail shows in its artifact box: only a figure or a table has a
 * picture to frame, rendered by the host when it supplies a renderer. A data
 * file or a metric gets no box — an empty reader column is all whitespace —
 * so the host renderer is not consulted for them here; `OutputPreview` still
 * asks it for the compact preview of any type, and a metric's value is asked
 * for as a compact rendering below.
 */
function artifactNode(
  output: Output,
  renderArtifact: ArtifactRenderer | undefined,
  result?: Result,
  status?: Status,
  universeRef?: string,
): ReactNode {
  if (!isVisualOutput(output)) return null;
  return renderArtifact ? (
    renderArtifact(output, { compact: false, result, status, universeRef })
  ) : (
    <ArtifactPreview output={output} result={result} status={status} compact={false} />
  );
}

export interface OutputDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: Output;
  result?: Result | undefined;
  status?: Status | undefined;
  universeRef?: string | undefined;
  relations: OutputRelations;
  renderArtifact?: ArtifactRenderer | undefined;
  /** Recorded execution information, shown below Recipe. */
  renderProvenance?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  /** Host-provided link to the current code file, shown beside Recipe. */
  renderCodeLink?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  renderText?: TextRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  /** Full-screen artifact state (controlled). */
  expanded?: boolean | undefined;
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}

/**
 * One decision per row. A decision the output declares reads plainly; one it
 * inherits says which upstream output carries it, so a list that mixes the two
 * still shows where each came from.
 */
function decisionDependencyItems(relations: OutputRelations, onOpenRecord: OpenRecordHandler | undefined) {
  return relationItemsForLinks(relations.decisions, onOpenRecord).map((item, index) => {
    const via = relations.decisions[index]?.via;
    const origins = via?.map(
      ({ record, ref, universeRef }) =>
        `${record ? recordTitle(record) : ref}${universeRef ? ` (${universeRef})` : ''}`,
    );
    if (!origins?.length) return item;
    const detail = `via ${origins.join(', ')}`;
    return {
      ...item,
      // The truncated text is for sighted readers; assistive technology gets
      // the full list, whether or not the row becomes a navigation trigger
      // (only a trigger carries `accessibleLabel`).
      detail: origins.length > 1
        ? (
          <span title={detail}>
            <span aria-hidden="true">via {origins[0]} +{origins.length - 1} more</span>
            <span className="astra-output-detail__visually-hidden">{detail}</span>
          </span>
        )
        : detail,
      accessibleLabel: item.accessibleLabel ? `${item.accessibleLabel}, ${detail}` : undefined,
    };
  });
}

/** Artifact preview with provenance: description, decisions, inputs, recipe and recorded status. */
export const OutputDetail = forwardRef<HTMLDivElement, OutputDetailProps>(function OutputDetail(
  {
    record: output,
    result,
    status,
    universeRef,
    relations,
    renderArtifact,
    renderProvenance,
    renderCodeLink,
    renderText,
    onOpenRecord,
    expanded = false,
    onExpandedChange,
    className,
    ...props
  },
  ref,
) {
  const labels = useLabels();
  const artifact = artifactNode(output, renderArtifact, result, status, universeRef);
  // A metric's whole artifact is one number: it reads as a pill at the head of
  // the provenance, above the description, not as a figure stretched across a
  // reader column.
  const metric =
    output.type === 'metric' ? renderArtifact?.(output, { compact: true, result, status, universeRef }) : null;
  // Reader layout (artifact column + details rail) only when there is an
  // artifact to frame: a host renderer may opt out of a figure or table by
  // returning null, and the details then take the single column instead.
  const visual = artifact != null;
  const exitFullScreen = useCallback(() => { onExpandedChange?.(false); }, [onExpandedChange]);
  // Inside a modal dialog, Escape reaches the full-screen layer through the
  // dialog's cancel event (the guard), which fires after any keydown handling
  // and cannot close the dialog underneath. Elsewhere the layer listens itself.
  const dialog = useOptionalDialog();
  const inModalDialog = dialog?.mode === 'modal';
  useDialogDismissGuard(expanded, exitFullScreen);
  useEffect(() => {
    if (!expanded || inModalDialog) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFullScreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [expanded, inModalDialog, exitFullScreen]);
  // The full-screen layer is a modal: focus enters it, everything outside it
  // (up to the enclosing native dialog, or the document) is inert while it
  // is open, and focus returns to the control that opened it.
  const layerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const layer = layerRef.current;
    if (!expanded || !layer) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const boundary: HTMLElement = layer.closest('dialog') ?? document.body;
    const inerted: Element[] = [];
    let node: HTMLElement = layer;
    while (node !== boundary) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== node && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          inerted.push(sibling);
        }
      }
      node = parent;
    }
    (layer.querySelector<HTMLElement>('button') ?? layer).focus();
    return () => {
      for (const element of inerted) element.removeAttribute('inert');
      if (opener?.isConnected) opener.focus();
    };
  }, [expanded]);

  const supportingDetails = (
    <aside className="astra-output-detail__provenance" aria-label="Output provenance and dependencies">
      {metric ? (
        <section className="astra-output-detail__metric">
          <h4>Metric</h4>
          <div className="astra-output-detail__metric-pill">{metric}</div>
        </section>
      ) : null}
      {output.description ? (
        <section className="astra-output-detail__description">
          <h4>Description</h4>
          <div className="astra-output-detail__description-text">
            <Prose text={output.description} field="description" renderText={renderText} />
          </div>
        </section>
      ) : null}
      <RelationList
        className="astra-detail__relations"
        title="Decision dependencies"
        items={decisionDependencyItems(relations, onOpenRecord)}
        empty="No decisions affect this output."
      />
      <RelationList
        className="astra-detail__relations"
        title={result ? 'Inputs and upstream outputs' : 'Declared dependencies'}
        items={relationItemsForLinks(relations.inputs, onOpenRecord).map((item) =>
          item.kind === 'output' ? { ...item, detail: 'intermediate output' } : item,
        )}
        empty="No upstream dependencies are declared for this output."
      />
      {relations.switches?.map((reference) => (
        <RelationList
          key={reference.ref}
          className="astra-detail__relations"
          title={`Switch ${reference.ref}`}
          description={`Decision: ${reference.decision}`}
          items={Object.entries(reference.cases).map(([option, target]) => ({
            key: option,
            label: option,
            identifier: target.target,
            detail: target.universe,
          }))}
          empty="No cases are declared for this switch."
        />
      ))}
      {result?.command ? (
        <section className="astra-output-detail__recipe">
          <div className="astra-output-detail__recipe-heading">
            <h4>Recipe</h4>
            {renderCodeLink?.(output, { result, status, universeRef })}
          </div>
          <pre>
            <code>{result.command}</code>
          </pre>
        </section>
      ) : null}
      {renderProvenance ? (
        renderProvenance(output, { result, status, universeRef })
      ) : status ? (
        <OutputProvenance status={status} />
      ) : null}
    </aside>
  );

  return (
    <div
      data-slot="output-detail"
      {...props}
      ref={ref}
      className={cn('astra-output-detail__layout', className)}
      data-layout={visual ? 'reader' : 'single'}
    >
      <div className="astra-output-detail__result">
        {artifact != null ? (
          <div
            ref={layerRef}
            className="astra-output-detail__artifact"
            data-type={output.type}
            {...(expanded
              ? {
                  'data-expanded': '',
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-label': `Full-screen ${output.type}: ${recordTitle(output)}`,
                }
              : {})}
          >
            {expanded ? (
              <div className="astra-output-detail__fullscreen-header">
                <span>
                  <small>{labels.actions.fullScreen}</small>
                  <strong>{recordTitle(output)}</strong>
                </span>
                <button type="button" onClick={() => onExpandedChange?.(false)}>
                  <span aria-hidden="true">×</span>
                  <span>{labels.actions.exitFullScreen}</span>
                </button>
              </div>
            ) : null}
            <div className="astra-output-detail__preview" data-type={output.type}>
              {output.type === 'figure' ? <FigureZoom key={output.ref}>{artifact}</FigureZoom> : artifact}
            </div>
          </div>
        ) : null}
        {!visual ? supportingDetails : null}
      </div>
      {visual ? <div className="astra-output-detail__provenance-slot">{supportingDetails}</div> : null}
    </div>
  );
});

export interface OutputDialogActionsProps {
  record: Output;
  /** The result shown; without one there is no artifact to open. */
  result?: Result | undefined;
  onOpenArtifact?: ((output: Output) => void | Promise<void>) | undefined;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

/** Header actions: open the artifact in the host, or expand a table. */
export function OutputDialogActions({ record: output, result, onOpenArtifact, expanded, onExpandedChange }: OutputDialogActionsProps) {
  const labels = useLabels();
  const canExpand = output.type === 'table';
  return (
    <>
      {onOpenArtifact && result ? (
        <DialogAction onClick={() => { void onOpenArtifact(output); }}>
          <span aria-hidden="true">↗</span>
          <span>{labels.actions.openArtifact}</span>
        </DialogAction>
      ) : null}
      {canExpand ? (
        <DialogAction
          aria-label={`View ${output.type} full screen`}
          aria-expanded={expanded}
          onClick={() => { onExpandedChange(true); }}
        >
          <span aria-hidden="true">⛶</span>
          <span>{labels.actions.fullScreen}</span>
        </DialogAction>
      ) : null}
    </>
  );
}
