import { useEffect, useMemo, useState } from 'react';
import type {
  ResourceDescriptor,
} from '@astra-spec/sdk/view-model';
import type { ResourcePreview } from '../viewer-types.js';
import { useOptionalAstraViewer } from '../context.js';
import { inventoryRecordTitle } from './model.js';
import type { InventoryOutputRecord } from '../types.js';

const TABLE_PREVIEW_DISPLAY_ROWS = 30;
const TABLE_PREVIEW_DISPLAY_COLUMNS = 30;

export function inventoryFileName(record: InventoryOutputRecord): string {
  return record.localId;
}

export function inventoryFileExtension(record: InventoryOutputRecord): string {
  const name = inventoryFileName(record);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : record.outputType.toUpperCase();
}

function compactValue(value: string | number | undefined): string {
  if (value == null || value === '') return 'Value unavailable';
  return typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumSignificantDigits: 5 })
    : value;
}

interface CanonicalPreview {
  preview?: ResourcePreview | undefined;
  resource?: ResourceDescriptor | undefined;
}

function useCanonicalPreview(record: InventoryOutputRecord): CanonicalPreview {
  const context = useOptionalAstraViewer();
  const output = useMemo(
    () => context?.index.recordById.get(record.id)?.kind === 'output'
      ? context.index.recordById.get(record.id) as InventoryOutputRecord
      : record,
    [context?.index, record],
  );
  const materialization = context?.runtime?.outputs[output.id];
  const resourceIds = materialization?.resourceIds.length
    ? materialization.resourceIds
    : output.resourceIds;
  const resource = resourceIds
    .map((resourceId) => context?.index.resourceById.get(resourceId))
    .find((candidate): candidate is ResourceDescriptor => Boolean(candidate));
  const [preview, setPreview] = useState<ResourcePreview | undefined>();

  useEffect(() => {
    if (output.metric?.value !== undefined) {
      setPreview({
        kind: 'metric',
        value: output.metric.value,
        ...(output.metric.uncertainty !== undefined
          ? { uncertainty: output.metric.uncertainty }
          : {}),
        ...(output.metric.unit ? { unit: output.metric.unit } : {}),
        ...(output.metric.label ? { label: output.metric.label } : {}),
      });
      return;
    }
    if (!resource || !context?.host.getPreview) {
      setPreview(undefined);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPreview(undefined);
    void context.host.getPreview(resource.id, {
      maxRows: TABLE_PREVIEW_DISPLAY_ROWS,
      maxColumns: TABLE_PREVIEW_DISPLAY_COLUMNS,
      maxBytes: 512_000,
      signal: controller.signal,
    }).then((nextPreview) => {
      if (active) setPreview(nextPreview);
    }).catch(() => {
      if (active && !controller.signal.aborted) setPreview(undefined);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [context, context?.runtime?.materializationRevision, output, resource]);

  return { preview, resource };
}

function FigurePreview({
  record,
  preview,
}: {
  record: InventoryOutputRecord;
  preview?: ResourcePreview | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const previewUrl = preview?.kind === 'image' ? preview.url : undefined;
  if (!previewUrl || failed) {
    return (
      <div className="inventory-output-preview__placeholder" aria-label="Figure preview unavailable">
        <span aria-hidden="true">▦</span>
        <span>Figure preview unavailable</span>
      </div>
    );
  }
  return (
    <img
      src={previewUrl}
      alt={`Preview of ${inventoryRecordTitle(record)}`}
      onError={() => setFailed(true)}
    />
  );
}

function TablePreview({
  preview,
  compact = false,
}: {
  preview?: ResourcePreview | undefined;
  compact?: boolean | undefined;
}) {
  const table = preview?.kind === 'table' ? preview : undefined;
  if (!table?.headers.length) {
    return (
      <div className="inventory-output-preview__placeholder" aria-label="Table preview unavailable">
        <span aria-hidden="true">▤</span>
        <span>Table preview unavailable</span>
      </div>
    );
  }
  const columnLimit = compact ? 5 : TABLE_PREVIEW_DISPLAY_COLUMNS;
  const rowLimit = compact ? 4 : TABLE_PREVIEW_DISPLAY_ROWS;
  const headers = table.headers.slice(0, columnLimit);
  const rows = table.rows.slice(0, rowLimit);
  const totalRows = table.totalRows ?? table.rows.length;
  const totalColumns = table.totalColumns ?? table.headers.length;
  return (
    <div className={`inventory-output-table${compact ? ' is-compact' : ''}`}>
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.slice(0, columnLimit).map((value, columnIndex) => (
                <td key={columnIndex}>{String(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!compact && (totalRows > rows.length || totalColumns > headers.length) ? (
        <p>
          Showing {rows.length} of {totalRows} rows and{' '}
          {headers.length} of {totalColumns} columns.
        </p>
      ) : null}
    </div>
  );
}

function MetricPreview({
  record,
  preview,
}: {
  record: InventoryOutputRecord;
  preview?: ResourcePreview | undefined;
}) {
  const metric = preview?.kind === 'metric' ? preview : record.metric;
  return (
    <div className="inventory-output-metric">
      <span className="inventory-output-metric__value">{compactValue(metric?.value)}</span>
      {metric?.uncertainty != null ? (
        <span className="inventory-output-metric__uncertainty">± {metric.uncertainty}</span>
      ) : null}
      {metric?.unit ? <span className="inventory-output-metric__unit">{metric.unit}</span> : null}
    </div>
  );
}

export function InventoryArtifactPreview({
  record,
  compact = false,
}: {
  record: InventoryOutputRecord;
  compact?: boolean | undefined;
}) {
  const { preview, resource } = useCanonicalPreview(record);
  if (record.outputType === 'figure') {
    return <FigurePreview record={record} preview={preview} />;
  }
  if (record.outputType === 'table') {
    return <TablePreview preview={preview} compact={compact} />;
  }
  if (record.outputType === 'metric') {
    return <MetricPreview record={record} preview={preview} />;
  }
  const fileName = resource?.fileName ?? inventoryFileName(record);
  const dot = fileName.lastIndexOf('.');
  const fileType = dot > 0
    ? fileName.slice(dot + 1).toUpperCase()
    : inventoryFileExtension(record);
  return (
    <div className="inventory-output-file-hero">
      <span aria-hidden="true">↳</span>
      <strong>{fileName}</strong>
      <small>{fileType}</small>
    </div>
  );
}
