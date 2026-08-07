import { useMemo } from 'react';
import {
  resolveProjectRecord,
  type ProjectRecordView,
  type RuntimeOverlayV1,
  type ViewerHost,
  type ViewerOpenReference,
} from '@lightcone-research/astra-viewer-model';
import { passiveViewerHost, useOptionalAstraViewer } from './context.js';
import { ResultViewer } from './result-viewer.js';
import { kindLabel, projectIndex, recordTitle, type ModelInput } from './shared.js';
import type { InventoryOpenReference } from './types.js';
import { Badge, Button, SurfaceHeader } from './ui.js';

export interface RecordDetailProps {
  model?: ModelInput;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  record?: ProjectRecordView;
  reference?: ViewerOpenReference | string;
  onClose?: () => void;
  onOpenReference?: (reference: InventoryOpenReference) => void;
}

function Prose({ children }: { children: string | undefined }) {
  return children ? <p>{children}</p> : null;
}

export function RecordDetail({
  model,
  runtime,
  host,
  record,
  reference,
  onClose,
  onOpenReference,
}: RecordDetailProps) {
  const context = useOptionalAstraViewer();
  const resolvedRuntime = runtime ?? context?.runtime;
  const resolvedHost = host ?? context?.host ?? passiveViewerHost;
  const index = useMemo(
    () => model ? projectIndex(model, resolvedRuntime) : context?.index,
    [context?.index, model, resolvedRuntime],
  );
  const resolvedRecord = record
    ?? (reference !== undefined && index
      ? resolveProjectRecord(index, reference)?.record
      : undefined);
  if (!resolvedRecord || !index) {
    return <div className="astra-record-detail"><p>ASTRA record not found.</p></div>;
  }

  const openRecord = (target: ProjectRecordView) => {
    onOpenReference?.({
      kind: target.kind,
      id: target.id,
      canonicalPath: target.canonicalPath,
    });
  };

  return (
    <article className="astra-record-detail" data-kind={resolvedRecord.kind}>
      <SurfaceHeader
        className="astra-record-detail__header"
        actionsClassName="astra-record-detail__header-actions"
        kind={resolvedRecord.kind}
        eyebrow={(
          <Badge kind={resolvedRecord.kind}>{kindLabel(resolvedRecord.kind)}</Badge>
        )}
        title={recordTitle(resolvedRecord)}
        titleAs="h2"
        identifier={resolvedRecord.canonicalPath}
        identifierClassName="astra-record-detail__path"
        actions={(
          <>
            {resolvedHost.capabilities.openSource && resolvedHost.openSource ? (
              <Button onClick={() => void resolvedHost.openSource!(resolvedRecord.id)}>
                Open source
              </Button>
            ) : null}
            {resolvedHost.capabilities.chatReference && resolvedHost.insertChatReference ? (
              <Button
                onClick={() => void resolvedHost.insertChatReference!({
                  kind: resolvedRecord.kind,
                  id: resolvedRecord.id,
                  canonicalPath: resolvedRecord.canonicalPath,
                })}
              >
                Reference in chat
              </Button>
            ) : null}
            {onClose ? (
              <Button onClick={onClose} aria-label="Close record detail">Close</Button>
            ) : null}
          </>
        )}
      />

      <section className="astra-record-detail__section">
        <Prose>{resolvedRecord.description}</Prose>
        {resolvedRecord.kind === 'decision' ? (
          <>
            <Prose>{resolvedRecord.rationale}</Prose>
            <h3>Options</h3>
            <ul className="astra-option-list">
              {resolvedRecord.options.map((option) => (
                <li key={option.id} data-selected={option.selected}>
                  <span>{option.label ?? option.id}</span>
                  {option.selected ? <strong>Selected</strong> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {resolvedRecord.kind === 'finding' || resolvedRecord.kind === 'prior_insight' ? (
          <>
            <Prose>{resolvedRecord.claim}</Prose>
            <Prose>{resolvedRecord.notes}</Prose>
            {resolvedRecord.evidence.length ? (
              <>
                <h3>Evidence</h3>
                <ul className="astra-evidence-list">
                  {resolvedRecord.evidence.map((evidence, indexValue) => (
                    <li key={indexValue}>
                      {evidence.quote ? <q>{evidence.quote}</q> : null}
                      {evidence.doi ? (
                        <button type="button" onClick={() => onOpenReference?.({ kind: 'paper', doi: evidence.doi! })}>
                          doi:{evidence.doi}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      {resolvedRecord.kind === 'output' ? (
        <ResultViewer
          output={resolvedRecord}
          model={index}
          {...(resolvedRuntime ? { runtime: resolvedRuntime } : {})}
          host={resolvedHost}
        />
      ) : null}

      {resolvedRecord.relations.length ? (
        <section className="astra-record-detail__section">
          <h3>Relationships</h3>
          <ul className="astra-relation-list">
            {resolvedRecord.relations.map((relation, relationIndex) => {
              const target = index.recordById.get(relation.targetRecordId);
              return (
                <li key={`${relation.kind}-${relation.targetRecordId}-${relationIndex}`}>
                  <span>{relation.kind.replaceAll('_', ' ')}</span>
                  {target ? (
                    <button type="button" onClick={() => openRecord(target)}>{recordTitle(target)}</button>
                  ) : <code>{relation.targetRecordId}</code>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
