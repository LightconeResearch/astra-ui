import { useMemo, useState } from 'react';
import {
  resolveProjectRecord,
  type ProjectRecordView,
  type ProjectScopeView,
  type ProjectViewModelIndex,
  type ProjectViewModelV1,
  type RuntimeOverlayV1,
  type ViewerHost,
} from '@lightcone-research/astra-viewer-model';
import { RecordDetail } from './record-detail.js';
import { kindLabel, projectIndex, RECORD_KINDS, recordTitle, type ModelInput } from './shared.js';
import type { InventoryOpenReference, InventoryPaperMetadataMap } from './types.js';

function scopeDepth(scope: ProjectScopeView, index: ProjectViewModelIndex): number {
  let depth = 0;
  let parentId = scope.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = index.scopeById.get(parentId)?.parentId;
  }
  return depth;
}

export interface OverviewInventoryProps {
  snapshot: ProjectViewModelV1;
  scopeId?: string;
  onSelectScope?: (scopeId: string) => void;
}

export function OverviewInventory({ snapshot, scopeId, onSelectScope }: OverviewInventoryProps) {
  const index = useMemo(() => projectIndex(snapshot), [snapshot]);
  return (
    <nav className="astra-scope-overview" aria-label="ASTRA analyses">
      <ul className="astra-scope-tree">
        {snapshot.scopes.map((scope) => (
          <li key={scope.id} style={{ paddingInlineStart: `${scopeDepth(scope, index) * 0.75}rem` }}>
            <button
              type="button"
              aria-current={scope.id === scopeId ? 'true' : undefined}
              onClick={() => onSelectScope?.(scope.id)}
            >
              {scope.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface InventoryExplorerProps {
  model?: ModelInput;
  snapshot?: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  scopeId?: string;
  openReference?: InventoryOpenReference;
  onOpenReference?: (reference: InventoryOpenReference) => void;
  onSelectScope?: (scopeId: string) => void;
  onClose?: () => void;
  /** Compatibility metadata for hosts that open cited-paper details. */
  paperMetadata?: InventoryPaperMetadataMap;
  /** Compatibility base URL for host-supplied PDF.js assets. */
  paperPdfAssetBaseUrl?: string;
}

function recordsInScope(index: ProjectViewModelIndex, scopeId: string): ProjectRecordView[] {
  const scope = index.scopeById.get(scopeId);
  return scope?.recordIds
    .map((recordId) => index.recordById.get(recordId))
    .filter((record): record is ProjectRecordView => Boolean(record)) ?? [];
}

export function InventoryExplorer({
  model,
  snapshot,
  runtime,
  host,
  scopeId,
  openReference,
  onOpenReference,
  onSelectScope,
  onClose,
}: InventoryExplorerProps) {
  const input = model ?? snapshot;
  if (!input) throw new Error('InventoryExplorer requires a model or snapshot.');
  const index = useMemo(() => projectIndex(input, runtime), [input, runtime]);
  const rootId = index.model.scopes.find((scope) => !scope.parentId)?.id
    ?? index.model.scopes[0]?.id;
  const [localScopeId, setLocalScopeId] = useState(scopeId ?? rootId ?? '');
  const activeScopeId = scopeId ?? localScopeId;
  const activeScope = index.scopeById.get(activeScopeId) ?? index.model.scopes[0];
  const located = openReference?.kind !== 'paper'
    ? openReference
      ? resolveProjectRecord(index, openReference, activeScope?.id)
      : undefined
    : undefined;
  const records = activeScope ? recordsInScope(index, activeScope.id) : [];

  const selectScope = (nextScopeId: string) => {
    setLocalScopeId(nextScopeId);
    onSelectScope?.(nextScopeId);
  };

  return (
    <section className="astra-inventory">
      <aside className="astra-inventory__sidebar">
        <h2>Analyses</h2>
        <OverviewInventory
          snapshot={index.model}
          {...(activeScope ? { scopeId: activeScope.id } : {})}
          onSelectScope={selectScope}
        />
      </aside>
      <div className="astra-inventory__content">
        {located ? (
          <RecordDetail
            model={index}
            {...(runtime ? { runtime } : {})}
            {...(host ? { host } : {})}
            record={located.record}
            {...(onClose ? { onClose } : {})}
            {...(onOpenReference ? { onOpenReference } : {})}
          />
        ) : (
          <>
            <header className="astra-inventory__header">
              <div>
                <h2>{activeScope?.name ?? index.model.project.name}</h2>
                {activeScope?.description ? <p>{activeScope.description}</p> : null}
              </div>
              <span className="astra-badge">{records.length} records</span>
            </header>
            {index.model.diagnostics.length ? (
              <details className="astra-diagnostics">
                <summary>{index.model.diagnostics.length} viewing diagnostics</summary>
                <ul>{index.model.diagnostics.map((diagnostic, diagnosticIndex) => (
                  <li key={`${diagnostic.code}-${diagnosticIndex}`} data-severity={diagnostic.severity}>
                    <strong>{diagnostic.code}</strong> {diagnostic.message}
                  </li>
                ))}</ul>
              </details>
            ) : null}
            {RECORD_KINDS.map((kind) => {
              const kindRecords = records.filter((record) => record.kind === kind);
              if (!kindRecords.length) return null;
              return (
                <section className="astra-record-group" key={kind}>
                  <h3>{kindLabel(kind)}s</h3>
                  <ul className="astra-record-list">
                    {kindRecords.map((record) => (
                      <li key={record.id}>
                        <button
                          className="astra-record-card"
                          type="button"
                          onClick={() => onOpenReference?.({
                            kind: record.kind,
                            id: record.id,
                            canonicalPath: record.canonicalPath,
                          })}
                        >
                          <strong>{recordTitle(record)}</strong>
                          <code>{record.canonicalPath}</code>
                          {record.description ? <span>{record.description}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
