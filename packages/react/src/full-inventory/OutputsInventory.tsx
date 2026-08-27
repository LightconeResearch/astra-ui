import { useEffect, useState } from 'react';
import type {
  ResolvedAnalysisNode,
  ResolvedOutput,
  ResolvedRecord,
} from '@astra-spec/sdk';
import {
  ArtifactPreview,
  type ArtifactRenderer,
} from '../artifact-preview.js';
import { InventoryProse, type TextRenderer } from './InventoryProse.js';
import {
  InventoryDetailDialog,
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import { analysisTitle, recordTitle } from './inventory-data.js';

export interface LinkedRecord {
  canonicalPath: string;
  record?: ResolvedRecord | undefined;
  analysis?: ResolvedAnalysisNode | undefined;
}

export interface OutputRelations {
  inputs: LinkedRecord[];
  decisions: LinkedRecord[];
  alias?: LinkedRecord | undefined;
}

export interface OutputsInventoryProps {
  analysis: ResolvedAnalysisNode;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpenOutput: (output: ResolvedOutput, analysis: ResolvedAnalysisNode) => void;
}

function OutputPreview({
  output,
  compact = false,
  renderArtifact,
}: {
  output: ResolvedOutput;
  compact?: boolean | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
}) {
  return renderArtifact
    ? <>{renderArtifact(output, { compact })}</>
    : <ArtifactPreview output={output} compact={compact} />;
}

function OutputCard({
  output,
  renderArtifact,
  onOpen,
}: {
  output: ResolvedOutput;
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="inventory-output-card" onClick={onOpen}>
      <span className="inventory-output-card__preview">
        <OutputPreview output={output} compact renderArtifact={renderArtifact} />
        <span className="inventory-output-card__open" aria-hidden="true">Open ↗</span>
      </span>
      <span className="inventory-output-card__body">
        <span className="inventory-output-card__kind">{output.type}</span>
        <strong>{recordTitle(output)}</strong>
        {output.label ? <code>{output.id}</code> : null}
      </span>
    </button>
  );
}

function OutputGallery({
  id,
  title,
  outputs,
  renderArtifact,
  onOpen,
}: {
  id: string;
  title: string;
  outputs: ResolvedOutput[];
  renderArtifact?: ArtifactRenderer | undefined;
  onOpen: (output: ResolvedOutput) => void;
}) {
  if (!outputs.length) return null;
  return (
    <section className="inventory-output-section" aria-labelledby={id}>
      <h3 id={id} className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">{title}</span>
      </h3>
      <div className="inventory-output-gallery">
        {outputs.map((output) => (
          <OutputCard
            key={output.canonicalPath}
            output={output}
            renderArtifact={renderArtifact}
            onOpen={() => onOpen(output)}
          />
        ))}
      </div>
    </section>
  );
}

function OutputFiles({
  outputs,
  onOpen,
}: {
  outputs: ResolvedOutput[];
  onOpen: (output: ResolvedOutput) => void;
}) {
  if (!outputs.length) return null;
  return (
    <section className="inventory-output-section inventory-output-files" aria-labelledby="other-outputs">
      <h3 id="other-outputs" className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">Other outputs</span>
      </h3>
      <InventoryRecordList
        ariaLabel="Other outputs"
        columnTemplate="minmax(14rem, 1fr) 1.5rem"
        columns={[
          { label: 'Output', className: 'inventory-record-list__primary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={outputs.map((output) => ({
          key: output.canonicalPath,
          accessibleLabel: recordTitle(output),
          onOpen: () => onOpen(output),
          cells: [
            <InventoryRecordIdentity
              kind="output"
              title={recordTitle(output)}
              subtitle={output.label ? output.id : output.format?.toUpperCase()}
            />,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </section>
  );
}

function relationItems(
  links: LinkedRecord[],
  onOpenDependency?: (record: ResolvedRecord, analysis: ResolvedAnalysisNode) => void,
) {
  return links.map((link) => ({
    key: link.canonicalPath,
    label: link.record ? recordTitle(link.record) : link.canonicalPath,
    identifier: link.canonicalPath,
    kind: link.record?.kind,
    accessibleLabel: link.record ? `View ${link.record.kind}: ${recordTitle(link.record)}` : undefined,
    onOpen: link.record && link.analysis && onOpenDependency
      ? () => onOpenDependency(link.record!, link.analysis!)
      : undefined,
  }));
}

export interface OutputDetailProps {
  output: ResolvedOutput;
  relations: OutputRelations;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  onOpenDependency?: (
    record: ResolvedRecord,
    analysis: ResolvedAnalysisNode,
  ) => void;
  expanded?: boolean | undefined;
  onExitFullScreen?: (() => void) | undefined;
}

export interface OutputDialogProps extends OutputDetailProps {
  analysis: ResolvedAnalysisNode;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

export function OutputDetail({
  output,
  relations,
  renderArtifact,
  renderText,
  onOpenDependency,
  expanded = false,
  onExitFullScreen,
}: OutputDetailProps) {
  const visual = output.type === 'figure' || output.type === 'table';
  const supportingDetails = (
    <aside className="inventory-output-provenance" aria-label="Output provenance and dependencies">
      {output.description ? (
        <section className="inventory-output-description">
          <h4>Description</h4>
          <div className="inventory-output-description__text">
            <InventoryProse text={output.description} renderText={renderText} />
          </div>
        </section>
      ) : null}
      {output.recipe?.command ? (
        <section className="inventory-output-recipe">
          <h4>Recipe</h4>
          <pre><code>{output.recipe.command}</code></pre>
          {output.recipe.container
            ? <p>Container: <code>{output.recipe.container}</code></p>
            : null}
        </section>
      ) : null}
      {output.resolvedFrom ? (
        <InventoryRelationList
          title="Resolved alias"
          items={relationItems([
            relations.alias ?? { canonicalPath: output.resolvedFrom },
          ], onOpenDependency)}
          empty={null}
        />
      ) : null}
      <InventoryRelationList
        title="Decision dependencies"
        items={relationItems(relations.decisions, onOpenDependency)}
        empty="No decision dependencies are declared for this output."
      />
      <InventoryRelationList
        title="Inputs and upstream outputs"
        items={relationItems(relations.inputs, onOpenDependency)}
        empty="No upstream dependencies are declared for this output."
      />
    </aside>
  );

  return (
    <div className={`inventory-output-dialog__layout inventory-output-dialog__layout--${visual ? 'reader' : 'single'}`}>
      <div className="inventory-output-dialog__result">
        <div
          className={`inventory-output-artifact is-${output.type}${expanded ? ' is-expanded' : ''}`}
          {...(expanded ? {
            role: 'dialog',
            'aria-modal': true,
            'aria-label': `Full-screen ${output.type}: ${recordTitle(output)}`,
          } : {})}
        >
          {expanded ? (
            <div className="inventory-artifact-fullscreen__header">
              <strong>{recordTitle(output)}</strong>
              <button type="button" onClick={onExitFullScreen}>Exit full screen</button>
            </div>
          ) : null}
          <div className={`inventory-output-dialog__preview is-${output.type}`}>
            <OutputPreview output={output} renderArtifact={renderArtifact} />
          </div>
        </div>
        {!visual ? supportingDetails : null}
      </div>
      {visual ? <div className="inventory-output-provenance-slot">{supportingDetails}</div> : null}
    </div>
  );
}

export function OutputDialog({
  output,
  analysis,
  relations,
  renderArtifact,
  renderText,
  onOpenDependency,
  onOpenArtifact,
  onBack,
  onClose,
}: OutputDialogProps) {
  const visual = output.type === 'figure' || output.type === 'table';
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [output.canonicalPath]);
  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  return (
    <InventoryDetailDialog
      className={visual ? 'inventory-detail-dialog--reader inventory-detail-dialog--output-reader' : undefined}
      kind="output"
      eyebrow={`${output.type} · ${analysisTitle(analysis)}`}
      title={recordTitle(output)}
      identifier={output.label ? output.id : undefined}
      onBack={onBack}
      headerActions={(
        <>
          {onOpenArtifact && output.artifact ? (
            <button type="button" onClick={() => void onOpenArtifact(output)}>Open artifact ↗</button>
          ) : null}
          {visual ? (
            <button
              type="button"
              aria-label={`View ${output.type} full screen`}
              aria-expanded={expanded}
              onClick={() => setExpanded(true)}
            >
              Full screen
            </button>
          ) : null}
        </>
      )}
      closeLabel="Close output details"
      onClose={onClose}
    >
      <OutputDetail
        output={output}
        relations={relations}
        {...(renderArtifact ? { renderArtifact } : {})}
        {...(renderText ? { renderText } : {})}
        {...(onOpenDependency ? { onOpenDependency } : {})}
        expanded={expanded}
        onExitFullScreen={() => setExpanded(false)}
      />
    </InventoryDetailDialog>
  );
}

export function OutputsInventory({
  analysis,
  renderArtifact,
  onOpenOutput,
}: OutputsInventoryProps) {
  const figures = analysis.outputs.filter(({ type }) => type === 'figure');
  const tables = analysis.outputs.filter(({ type }) => type === 'table');
  const files = analysis.outputs.filter(({ type }) => type !== 'figure' && type !== 'table');
  if (!analysis.outputs.length) {
    return (
      <InventoryEmptyState className="inventory-output-empty">
        No outputs are declared in this analysis.
      </InventoryEmptyState>
    );
  }
  return (
    <div className="inventory-outputs">
      <OutputGallery
        id="figures"
        title="Figures"
        outputs={figures}
        renderArtifact={renderArtifact}
        onOpen={(output) => onOpenOutput(output, analysis)}
      />
      <OutputGallery
        id="tables"
        title="Tables"
        outputs={tables}
        renderArtifact={renderArtifact}
        onOpen={(output) => onOpenOutput(output, analysis)}
      />
      <OutputFiles outputs={files} onOpen={(output) => onOpenOutput(output, analysis)} />
    </div>
  );
}
