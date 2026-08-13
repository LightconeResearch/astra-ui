import { useEffect, useState } from 'react';
import { InventoryProse } from './InventoryProse.js';
import {
  InventoryArtifactPreview,
  inventoryFileName,
} from './InventoryArtifactPreview.js';
import {
  InventoryDetailDialog,
  InventoryEmptyState,
  InventoryRecordIdentity,
  InventoryRecordList,
} from './InventoryPrimitives.js';
import { InventoryRelationList } from './InventoryRelations.js';
import {
  getInventoryScope,
  inventoryRecordTitle,
  inventoryRecordsOfKind,
  resolveInventoryRecordReference,
  type InventoryModel,
} from './model.js';
import type {
  InventoryOutputRecord,
  InventoryRecord,
  InventoryScope,
} from '../types.js';

interface OutputsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenOutput: (output: InventoryOutputRecord, scope: InventoryScope) => void;
}

function OutputCard({
  record,
  onOpen,
}: {
  record: InventoryOutputRecord;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="inventory-output-card" onClick={onOpen}>
      <span className="inventory-output-card__preview">
        <InventoryArtifactPreview record={record} compact />
        <span className="inventory-output-card__open" aria-hidden="true">Open ↗</span>
      </span>
      <span className="inventory-output-card__body">
        <span className="inventory-output-card__kind">{record.outputType}</span>
        <strong>{inventoryRecordTitle(record)}</strong>
        {record.label ? <code>{record.localId}</code> : null}
      </span>
    </button>
  );
}

function OutputGallery({
  id,
  title,
  records,
  onOpen,
}: {
  id: string;
  title: string;
  records: InventoryOutputRecord[];
  onOpen: (record: InventoryOutputRecord) => void;
}) {
  if (!records.length) return null;
  return (
    <section className="inventory-output-section" aria-labelledby={id}>
      <h3 id={id} className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">{title}</span>
      </h3>
      <div className="inventory-output-gallery">
        {records.map((record) => (
          <OutputCard key={record.id} record={record} onOpen={() => onOpen(record)} />
        ))}
      </div>
    </section>
  );
}

function OutputTables({
  records,
  onOpen,
}: {
  records: InventoryOutputRecord[];
  onOpen: (record: InventoryOutputRecord) => void;
}) {
  if (!records.length) return null;
  return (
    <section className="inventory-output-section inventory-output-tables" aria-labelledby="tables">
      <h3 id="tables" className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">Tables</span>
      </h3>
      <div className="inventory-output-table-list">
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            className="inventory-output-table-card"
            aria-label={`Open table: ${inventoryRecordTitle(record)}`}
            onClick={() => onOpen(record)}
          >
            <span className="inventory-output-table-card__preview">
              <InventoryArtifactPreview record={record} compact />
            </span>
            <span className="inventory-output-table-card__footer">
              <span>
                <small>Table</small>
                <strong>{inventoryRecordTitle(record)}</strong>
              </span>
              <span>{record.localId} ↗</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Files({
  records,
  onOpen,
}: {
  records: InventoryOutputRecord[];
  onOpen: (record: InventoryOutputRecord) => void;
}) {
  if (!records.length) return null;
  return (
    <section className="inventory-output-section inventory-output-files" aria-labelledby="files">
      <h3 id="files" className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">Files</span>
      </h3>
      <InventoryRecordList
        ariaLabel="Files"
        columnTemplate="minmax(14rem, 1fr) 1.5rem"
        columns={[
          { label: 'File', className: 'inventory-record-list__primary' },
          { className: 'inventory-record-list__arrow' },
        ]}
        rows={records.map((record) => ({
          key: record.id,
          accessibleLabel: inventoryFileName(record),
          onOpen: () => onOpen(record),
          cells: [
            <InventoryRecordIdentity kind="file" title={inventoryFileName(record)} />,
            <span aria-hidden="true">→</span>,
          ],
        }))}
      />
    </section>
  );
}

interface ProvenanceRecord {
  id: string;
  label?: string | undefined;
  record?: InventoryRecord | undefined;
  scope?: InventoryScope | undefined;
}

interface DecisionDependency extends ProvenanceRecord {
  via?: string | undefined;
  relationship: 'direct' | 'indirect';
}

function decisionDependencies(
  model: InventoryModel,
  scope: InventoryScope,
  output: InventoryOutputRecord,
): DecisionDependency[] {
  return output.provenance.decisions.map((dependency) => {
    const resolved = dependency.recordId
      ? model.recordById.get(dependency.recordId)
      : resolveInventoryRecordReference(model, scope, dependency.reference, 'decision')?.record;
    const owner = resolved ? model.scopeById.get(resolved.scopeId) : undefined;
    return {
      id: dependency.recordId ?? dependency.reference,
      label: dependency.label ?? resolved?.label ?? resolved?.localId ?? dependency.reference,
      ...(dependency.scopeId ? { via: dependency.scopeId } : {}),
      relationship: dependency.direct ? 'direct' : 'indirect',
      ...(resolved ? { record: resolved } : {}),
      ...(owner ? { scope: owner } : {}),
    };
  });
}

function upstreamRecords(
  model: InventoryModel,
  scope: InventoryScope,
  output: InventoryOutputRecord,
): ProvenanceRecord[] {
  const references = [...output.provenance.inputs];
  const alias = output.relations.find((relation) => relation.kind === 'aliases');
  if (alias) {
    const target = model.recordById.get(alias.targetRecordId);
    if (target) {
      references.push({
        reference: target.localId,
        recordId: target.id,
        ...(target.label ? { label: target.label } : {}),
        direct: true,
      });
    }
  }
  const records = new Map<string, ProvenanceRecord>();
  for (const reference of references) {
    const resolved = reference.recordId
      ? model.recordById.get(reference.recordId)
      : resolveInventoryRecordReference(model, scope, reference.reference)?.record;
    const owner = resolved ? model.scopeById.get(resolved.scopeId) : undefined;
    const key = resolved?.id ?? reference.reference;
    if (!records.has(key)) {
      records.set(key, {
        id: key,
        label: reference.label ?? resolved?.label ?? resolved?.localId,
        ...(resolved ? { record: resolved } : {}),
        ...(owner ? { scope: owner } : {}),
      });
    }
  }
  return [...records.values()];
}

export interface OutputDetailProps {
  record: InventoryOutputRecord;
  scope: InventoryScope;
  model: InventoryModel;
  onOpenDependency?: ((record: InventoryRecord, scope: InventoryScope) => void) | undefined;
  expanded?: boolean | undefined;
  onExitFullScreen?: (() => void) | undefined;
}

export function OutputDetail({
  record,
  scope,
  model,
  onOpenDependency,
  expanded = false,
  onExitFullScreen,
}: OutputDetailProps) {
  const visualResult = record.outputType === 'figure' || record.outputType === 'table';
  const inputs = upstreamRecords(model, scope, record);
  const dependencies = decisionDependencies(model, scope, record);
  const directDependencies = dependencies.filter(
    (dependency) => dependency.relationship === 'direct',
  );
  const indirectDependencies = dependencies.filter(
    (dependency) => dependency.relationship === 'indirect',
  );
  const [showIndirectDependencies, setShowIndirectDependencies] = useState(false);

  useEffect(() => {
    setShowIndirectDependencies(false);
  }, [record.id]);

  const visibleDependencies = showIndirectDependencies
    ? dependencies
    : directDependencies;

  const renderSupportingDetails = (sidebar: boolean) => {
    const Wrapper = sidebar ? 'aside' : 'section';
    return (
      <Wrapper
        className={`inventory-output-provenance ${sidebar ? 'is-sidebar' : 'is-inline'}`}
        aria-label={sidebar ? 'Output details' : 'Output provenance and dependencies'}
      >
        {sidebar && record.description ? (
          <section className="inventory-output-description inventory-output-description--rail">
            <h4>Description</h4>
            <div className="inventory-output-description__text">
              <InventoryProse text={record.description} />
            </div>
          </section>
        ) : null}
        {record.recipe?.command ? (
          <section className="inventory-output-recipe">
            <h4>Recipe</h4>
            <pre><code>{record.recipe.command}</code></pre>
            {record.recipe.container
              ? <p>Container: <code>{record.recipe.container}</code></p>
              : null}
          </section>
        ) : <p className="inventory-output-provenance__empty">No recipe is declared for this output.</p>}
        <InventoryRelationList
          title="Decision dependencies"
          className="inventory-output-provenance__group inventory-output-dependencies"
          headerAction={indirectDependencies.length ? (
            <label className="inventory-dependency-toggle">
              <input
                type="checkbox"
                aria-label="Include indirect decision dependencies"
                checked={showIndirectDependencies}
                onChange={(event) => setShowIndirectDependencies(event.target.checked)}
              />
              <span>Include indirect</span>
            </label>
          ) : undefined}
          items={visibleDependencies.map((dependency) => ({
            key: `${dependency.relationship}-${dependency.id}`,
            label: dependency.label,
            kind: 'decision',
            className: `is-${dependency.relationship}`,
            accessibleLabel: dependency.record
              ? `View ${dependency.relationship} decision dependency: ${dependency.label}`
              : undefined,
            onOpen: dependency.record && dependency.scope && onOpenDependency
              ? () => onOpenDependency(dependency.record!, dependency.scope!)
              : undefined,
          }))}
          empty={indirectDependencies.length
            ? null
            : 'No decision dependencies are resolved in this model.'}
        />
        <InventoryRelationList
          title="Inputs and upstream outputs"
          className="inventory-output-provenance__group inventory-output-provenance__group--scrollable"
          items={inputs.map((input) => ({
            key: input.id,
            label: input.label ?? input.id,
            kind: input.record?.kind === 'output' ? 'output' : 'input',
            className: input.record?.kind === 'output' ? 'is-output' : 'is-input',
            accessibleLabel: input.record
              ? `View ${input.record.kind}: ${input.label ?? input.id}`
              : undefined,
            onOpen: input.record && input.scope && onOpenDependency
              ? () => onOpenDependency(input.record!, input.scope!)
              : undefined,
          }))}
          empty="No upstream dependencies are resolved in this model."
        />
      </Wrapper>
    );
  };

  return (
    <div className={`inventory-output-dialog__layout inventory-output-dialog__layout--${visualResult ? 'reader' : 'single'}`}>
      <div className="inventory-output-dialog__result">
        {visualResult ? (
          <div
            className={`inventory-output-artifact is-${record.outputType}${expanded ? ' is-expanded' : ''}`}
            {...(expanded ? {
              role: 'dialog',
              'aria-modal': true,
              'aria-label': `Full-screen ${record.outputType}: ${inventoryRecordTitle(record)}`,
            } : {})}
          >
            <div className="inventory-artifact-fullscreen__header">
              <span>
                <small>Full screen</small>
                <strong>{inventoryRecordTitle(record)}</strong>
              </span>
              <button
                type="button"
                aria-label="Exit full-screen result"
                onClick={onExitFullScreen}
              >
                <span aria-hidden="true">×</span>
                <span>Exit full screen</span>
              </button>
            </div>
            <div className={`inventory-output-dialog__preview is-${record.outputType}`}>
              <InventoryArtifactPreview record={record} />
            </div>
          </div>
        ) : record.outputType === 'metric' ? (
          <div className="inventory-output-dialog__inline-result" aria-label="Result value">
            <InventoryArtifactPreview record={record} compact />
          </div>
        ) : null}
        {!visualResult && record.description ? (
          <section className="inventory-output-description">
            <h4>Description</h4>
            <div className="inventory-output-description__text">
              <InventoryProse text={record.description} />
            </div>
          </section>
        ) : null}
        {!visualResult ? renderSupportingDetails(false) : null}
      </div>
      {visualResult ? (
        <div className="inventory-output-provenance-slot">
          {renderSupportingDetails(true)}
        </div>
      ) : null}
    </div>
  );
}

export function OutputDialog({
  record,
  scope,
  model,
  onOpenDependency,
  onBack,
  onClose,
}: OutputDetailProps & {
  onOpenDependency: (record: InventoryRecord, scope: InventoryScope) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  const visualResult = record.outputType === 'figure' || record.outputType === 'table';
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [record.id]);
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
      className={visualResult
        ? 'inventory-detail-dialog--reader inventory-detail-dialog--output-reader'
        : undefined}
      kind="output"
      eyebrow={`${record.outputType} · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.localId : undefined}
      onBack={onBack}
      headerActions={visualResult ? (
        <button
          type="button"
          className="inventory-detail-dialog__header-action"
          aria-label={`View ${record.outputType} full screen`}
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
        >
          <span aria-hidden="true">⛶</span>
          <span>Full screen</span>
        </button>
      ) : undefined}
      closeLabel="Close output details"
      onClose={onClose}
    >
      <OutputDetail
        record={record}
        scope={scope}
        model={model}
        onOpenDependency={onOpenDependency}
        expanded={expanded}
        onExitFullScreen={() => setExpanded(false)}
      />
    </InventoryDetailDialog>
  );
}

export function OutputsInventory({ model, scopeId, onOpenOutput }: OutputsInventoryProps) {
  const scope = getInventoryScope(model, scopeId);
  const records = scope ? inventoryRecordsOfKind(scope, 'output', model) : [];
  const figures = records.filter((record) => record.outputType === 'figure');
  const tables = records.filter((record) => record.outputType === 'table');
  const additional = records.filter(
    (record) => record.outputType !== 'figure' && record.outputType !== 'table',
  );
  if (!scope || records.length === 0) {
    return (
      <InventoryEmptyState className="inventory-output-empty">
        No outputs are declared in this analysis.
      </InventoryEmptyState>
    );
  }
  return (
    <div className="inventory-outputs">
      <OutputGallery id="figures" title="Figures" records={figures} onOpen={(record) => onOpenOutput(record, scope)} />
      <OutputTables records={tables} onOpen={(record) => onOpenOutput(record, scope)} />
      <Files records={additional} onOpen={(record) => onOpenOutput(record, scope)} />
    </div>
  );
}
