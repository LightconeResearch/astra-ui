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
import type { InventoryRecord, InventoryScope } from './types.js';

interface OutputsInventoryProps {
  model: InventoryModel;
  scopeId: string;
  onOpenOutput: (output: InventoryRecord, scope: InventoryScope) => void;
}

function OutputCard({ record, onOpen }: { record: InventoryRecord; onOpen: () => void }) {
  return (
    <button type="button" className="inventory-output-card" onClick={onOpen}>
      <span className="inventory-output-card__preview">
        <InventoryArtifactPreview record={record} compact />
        <span className="inventory-output-card__open" aria-hidden="true">Open ↗</span>
      </span>
      <span className="inventory-output-card__body">
        <span className="inventory-output-card__kind">{record.type ?? 'output'}</span>
        <strong>{inventoryRecordTitle(record)}</strong>
        {record.label ? <code>{record.id}</code> : null}
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
  records: InventoryRecord[];
  onOpen: (record: InventoryRecord) => void;
}) {
  if (!records.length) return null;
  return (
    <section className="inventory-output-section" aria-labelledby={id}>
      <h3 id={id} className="inventory-output-section__heading exclude-from-outline">
        <span className="heading-text">{title}</span>
      </h3>
      <div className="inventory-output-gallery">
        {records.map((record) => (
          <OutputCard key={record.path} record={record} onOpen={() => onOpen(record)} />
        ))}
      </div>
    </section>
  );
}

function Files({ records, onOpen }: {
  records: InventoryRecord[];
  onOpen: (record: InventoryRecord) => void;
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
          key: record.path,
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

interface DecisionDependency {
  id: string;
  label: string;
  via?: string | undefined;
  relationship: 'direct' | 'indirect';
  record?: InventoryRecord | undefined;
  scope?: InventoryScope | undefined;
}

function resolveDecisionDependency(
  model: InventoryModel,
  scope: InventoryScope,
  id: string,
  via?: string,
) {
  const owner = via
    ? model.scopeById.get(via) ?? model.scopeByPath.get(via)
    : undefined;
  const ownedDecision = owner?.records.find(
    (record) => record.kind === 'decision' && record.id === id,
  );
  if (owner && ownedDecision) return { record: ownedDecision, scope: owner };
  const resolved = resolveInventoryRecordReference(model, scope, id);
  return resolved?.record.kind === 'decision' ? resolved : undefined;
}

function decisionDependencies(
  model: InventoryModel,
  scope: InventoryScope,
  output: InventoryRecord,
): DecisionDependency[] {
  const directIds = output.decisions ?? [];
  const directIdSet = new Set(directIds);
  const transitive = output.decisions_transitive ?? [];

  const direct = directIds.map((id) => {
    const metadata = transitive.find((candidate) => candidate.id === id);
    const resolved = resolveDecisionDependency(model, scope, id, metadata?.via);
    return {
      id,
      label: metadata?.label ?? resolved?.record.label ?? id,
      via: metadata?.via,
      relationship: 'direct' as const,
      record: resolved?.record,
      scope: resolved?.scope,
    };
  });

  const indirect = transitive
    .filter((dependency) => !directIdSet.has(dependency.id))
    .map((dependency) => {
      const resolved = resolveDecisionDependency(
        model,
        scope,
        dependency.id,
        dependency.via,
      );
      return {
        id: dependency.id,
        label: dependency.label ?? resolved?.record.label ?? dependency.id,
        via: dependency.via,
        relationship: 'indirect' as const,
        record: resolved?.record,
        scope: resolved?.scope,
      };
    });

  return [...direct, ...indirect];
}

function upstreamRecords(
  model: InventoryModel,
  scope: InventoryScope,
  output: InventoryRecord,
): ProvenanceRecord[] {
  const references: Array<{ id: string; label?: string }> = [
    ...(output.inputs ?? []).map((id) => ({ id })),
    ...(output.inputs_root ?? []).map((input) => ({ id: input.id, label: input.label })),
    ...(output.from ? [{ id: output.from }] : []),
  ];
  const records = new Map<string, ProvenanceRecord>();
  for (const reference of references) {
    if (records.has(reference.id)) continue;
    const resolved = resolveInventoryRecordReference(model, scope, reference.id);
    records.set(reference.id, {
      id: reference.id,
      label: reference.label ?? resolved?.record.label,
      record: resolved?.record,
      scope: resolved?.scope,
    });
  }
  return [...records.values()];
}

export interface OutputDetailProps {
  record: InventoryRecord;
  scope: InventoryScope;
  model: InventoryModel;
  onOpenDependency?: ((record: InventoryRecord, scope: InventoryScope) => void) | undefined;
}

/**
 * Host-neutral output detail body.
 *
 * MyST renders this inside InventoryDetailDialog. Other hosts, such as
 * JupyterLab, can supply their own panel chrome while preserving the exact
 * ASTRA result, description, recipe, and provenance presentation.
 */
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

  useEffect(() => {
    setShowIndirectDependencies(false);
  }, [record.path]);

  const visibleDependencies = showIndirectDependencies
    ? dependencies
    : directDependencies;

  return (
    <div className="inventory-output-dialog__layout inventory-output-dialog__layout--stacked">
      <div className="inventory-output-dialog__result">
        <div className={`inventory-output-dialog__preview is-${record.type ?? 'output'}`}>
          <InventoryArtifactPreview record={record} />
        </div>
      </div>

      <div className="inventory-output-provenance-slot">
        <aside className="inventory-output-provenance" aria-label="Output details">
          <header className="inventory-output-provenance__header">
            <span>Output details</span>
            <strong>{record.type ?? 'output'}</strong>
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
              {record.recipe.container ? <p>Container: <code>{record.recipe.container}</code></p> : null}
            </details>
          ) : <p className="inventory-output-provenance__empty">No recipe is declared for this output.</p>}
          <InventoryRelationList
            title="Decision dependencies"
            className="inventory-output-provenance__group inventory-output-dependencies"
            description="Method choices recorded for this output."
            headerAction={indirectDependencies.length ? (
              <label
                className="inventory-dependency-toggle"
              >
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
              key: `${dependency.relationship}-${dependency.via ?? 'local'}-${dependency.id}`,
              label: dependency.label,
              identifier: dependency.record?.path ?? dependency.id,
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
              : 'No decision dependencies are resolved in this snapshot.'}
          />
          <InventoryRelationList
            title="Inputs and upstream outputs"
            className="inventory-output-provenance__group inventory-output-provenance__group--scrollable"
            description="Trace the data products this result was built from."
            items={inputs.map((input) => ({
              key: input.id,
              label: input.label ?? input.id,
              identifier: input.record?.path ?? input.id,
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
            empty="No upstream dependencies are resolved in this snapshot."
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
      eyebrow={`${record.type ?? 'output'} · ${scope.name}`}
      title={inventoryRecordTitle(record)}
      identifier={record.label ? record.id : undefined}
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
  const records = scope ? inventoryRecordsOfKind(scope, 'output') : [];
  const figures = records.filter((record) => record.type === 'figure');
  const tables = records.filter((record) => record.type === 'table');
  const additional = records.filter(
    (record) => record.type !== 'figure' && record.type !== 'table',
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
