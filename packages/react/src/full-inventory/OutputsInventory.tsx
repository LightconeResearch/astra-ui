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
}

export function OutputDetail({
  record,
  scope,
  model,
  onOpenDependency,
}: OutputDetailProps) {
  const inputs = upstreamRecords(model, scope, record);
  const dependencies = decisionDependencies(model, scope, record);
  const directDependencies = dependencies.filter(
    (dependency) => dependency.relationship === 'direct',
  );
  const indirectDependencies = dependencies.filter(
    (dependency) => dependency.relationship === 'indirect',
  );
  const [showIndirectDependencies, setShowIndirectDependencies] = useState(false);

  useEffect(() => setShowIndirectDependencies(false), [record.id]);
  const visibleDependencies = showIndirectDependencies
    ? dependencies
    : directDependencies;

  return (
    <div className="inventory-output-dialog__layout inventory-output-dialog__layout--stacked">
      <div className="inventory-output-dialog__result">
        <div className={`inventory-output-dialog__preview is-${record.outputType}`}>
          <InventoryArtifactPreview record={record} />
        </div>
      </div>
      <div className="inventory-output-provenance-slot">
        <aside className="inventory-output-provenance" aria-label="Output details">
          <header className="inventory-output-provenance__header">
            <span>Output details</span>
            <strong>{record.outputType}</strong>
          </header>
          {record.description ? (
            <section className="inventory-output-description">
              <h4>Description</h4>
              <div className="inventory-output-description__text">
                <InventoryProse text={record.description} />
              </div>
            </section>
          ) : null}
          {record.recipe?.command ? (
            <details className="inventory-output-recipe" open>
              <summary>Recipe</summary>
              <pre><code>{record.recipe.command}</code></pre>
              {record.recipe.container
                ? <p>Container: <code>{record.recipe.container}</code></p>
                : null}
            </details>
          ) : <p className="inventory-output-provenance__empty">No recipe is declared for this output.</p>}
          <InventoryRelationList
            title="Decision dependencies"
            className="inventory-output-provenance__group inventory-output-dependencies"
            description="Method choices recorded for this output."
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
              detail: [
                dependency.relationship === 'direct' ? 'Direct' : 'Indirect',
                dependency.scope?.name ?? dependency.via,
              ].filter(Boolean).join(' · '),
              className: `is-${dependency.relationship}`,
              accessibleLabel: dependency.record
                ? `View ${dependency.relationship} decision dependency: ${dependency.label}`
                : undefined,
              onOpen: dependency.record && dependency.scope && onOpenDependency
                ? () => onOpenDependency(dependency.record!, dependency.scope!)
                : undefined,
            }))}
            empty={indirectDependencies.length
              ? 'No decisions are referenced directly by this output recipe.'
              : 'No decision dependencies are resolved in this model.'}
          />
          <InventoryRelationList
            title="Inputs and upstream outputs"
            className="inventory-output-provenance__group inventory-output-provenance__group--scrollable"
            description="Trace the data products this result was built from."
            items={inputs.map((input) => ({
              key: input.id,
              label: input.label ?? input.id,
              kind: input.record?.kind === 'output' ? 'output' : 'input',
              detail: [
                input.record?.kind === 'output' ? 'Upstream output' : 'Input',
                input.scope?.name,
              ].filter(Boolean).join(' · '),
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
        </aside>
      </div>
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
  return (
    <InventoryDetailDialog
      kind="output"
      eyebrow={`${record.outputType} · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.localId : undefined}
      onBack={onBack}
      closeLabel="Close output details"
      onClose={onClose}
    >
      <OutputDetail
        record={record}
        scope={scope}
        model={model}
        onOpenDependency={onOpenDependency}
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
      <OutputGallery id="tables" title="Tables" records={tables} onOpen={(record) => onOpenOutput(record, scope)} />
      <Files records={additional} onOpen={(record) => onOpenOutput(record, scope)} />
    </div>
  );
}
