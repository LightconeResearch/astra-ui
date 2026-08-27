import type { ResolvedOutput } from '@astra-spec/sdk';
import { forwardRef, useCallback, useEffect, useState, type HTMLAttributes } from 'react';
import type { OutputRelations } from '../model/relations.js';
import { isVisualOutput, recordTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { ArtifactPreview, type ArtifactRenderer } from './artifact-preview.js';
import { DialogAction, useDialogDismissGuard, useOptionalDialog } from '../primitives/dialog.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';
import { RelationList } from '../primitives/relation-list.js';
import { relationItemsForLinks, type OpenRecordHandler } from './relation-items.js';

export interface OutputPreviewProps {
  output: ResolvedOutput;
  compact?: boolean | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
}

/** The host's artifact renderer, or the built-in placeholder preview. */
export function OutputPreview({ output, compact = false, renderArtifact }: OutputPreviewProps) {
  return renderArtifact
    ? <>{renderArtifact(output, { compact })}</>
    : <ArtifactPreview output={output} compact={compact} />;
}

export interface OutputDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedOutput;
  relations: OutputRelations;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  /** Full-screen artifact state (controlled). */
  expanded?: boolean | undefined;
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}

/** Artifact preview with provenance: description, recipe, alias, decisions, and inputs. */
export const OutputDetail = forwardRef<HTMLDivElement, OutputDetailProps>(function OutputDetail({
  record: output,
  relations,
  renderArtifact,
  renderText,
  onOpenRecord,
  expanded = false,
  onExpandedChange,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  const visual = isVisualOutput(output);
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

  const supportingDetails = (
    <aside className="astra-output-detail__provenance" aria-label="Output provenance and dependencies">
      {output.description ? (
        <section className="astra-output-detail__description">
          <h4>Description</h4>
          <div className="astra-output-detail__description-text">
            <Prose text={output.description} field="description" renderText={renderText} />
          </div>
        </section>
      ) : null}
      {output.recipe?.command ? (
        <section className="astra-output-detail__recipe">
          <h4>Recipe</h4>
          <pre><code>{output.recipe.command}</code></pre>
          {output.recipe.container
            ? <p>Container: <code>{output.recipe.container}</code></p>
            : null}
        </section>
      ) : null}
      {output.resolvedFrom ? (
        <RelationList
          className="astra-detail__relations"
          title="Resolved alias"
          items={relationItemsForLinks([relations.alias ?? { canonicalPath: output.resolvedFrom }], onOpenRecord)}
          empty={null}
        />
      ) : null}
      <RelationList
        className="astra-detail__relations"
        title="Decision dependencies"
        items={relationItemsForLinks(relations.decisions, onOpenRecord)}
        empty="No decision dependencies are declared for this output."
      />
      <RelationList
        className="astra-detail__relations"
        title="Inputs and upstream outputs"
        items={relationItemsForLinks(relations.inputs, onOpenRecord)}
        empty="No upstream dependencies are declared for this output."
      />
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
        <div
          className="astra-output-detail__artifact"
          data-type={output.type}
          {...(expanded
            ? { 'data-expanded': '', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Full-screen ${output.type}: ${recordTitle(output)}` }
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
            <OutputPreview output={output} renderArtifact={renderArtifact} />
          </div>
        </div>
        {!visual ? supportingDetails : null}
      </div>
      {visual ? <div className="astra-output-detail__provenance-slot">{supportingDetails}</div> : null}
    </div>
  );
});

export interface OutputDialogActionsProps {
  record: ResolvedOutput;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

/** Header actions for an output: open the artifact in the host, enter full screen. */
export function OutputDialogActions({ record: output, onOpenArtifact, expanded, onExpandedChange }: OutputDialogActionsProps) {
  const labels = useLabels();
  const visual = isVisualOutput(output);
  return (
    <>
      {onOpenArtifact && output.artifact ? (
        <DialogAction onClick={() => { void onOpenArtifact(output); }}>
          <span aria-hidden="true">↗</span>
          <span>{labels.actions.openArtifact}</span>
        </DialogAction>
      ) : null}
      {visual ? (
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

/** Full-screen state for an output, reset whenever the output changes. */
export function useOutputExpanded(output: ResolvedOutput, controlled?: { expanded?: boolean | undefined; onExpandedChange?: ((next: boolean) => void) | undefined }) {
  const [internal, setInternal] = useState(false);
  const [lastPath, setLastPath] = useState(output.canonicalPath);
  if (lastPath !== output.canonicalPath) {
    setLastPath(output.canonicalPath);
    setInternal(false);
  }
  const isControlled = controlled?.expanded !== undefined;
  const expanded = isControlled ? Boolean(controlled.expanded) : internal;
  const onChange = controlled?.onExpandedChange;
  const setExpanded = useCallback((next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [expanded, setExpanded] as const;
}
