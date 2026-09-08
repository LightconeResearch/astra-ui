/** Host-safe artifact preview data, and pure builders (no I/O) hosts use to produce it from data they already loaded. */

export interface TablePreviewData {
  kind: 'table';
  headers: string[];
  rows: (string | number | boolean | null)[][];
  /** Exact number of rows in the source. Leave unset when the source was sampled and the total is unknown. */
  totalRows?: number | undefined;
  totalColumns?: number | undefined;
  /** The preview does not show everything: rows or columns were cut, or the source itself was a sample. */
  truncated?: boolean | undefined;
}

export interface ImagePreviewData {
  kind: 'image';
  url: string;
  alt?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface MetricPreviewData {
  kind: 'metric';
  value: number | string;
  uncertainty?: number | string | undefined;
  unit?: string | undefined;
  label?: string | undefined;
}

export interface TextPreviewData {
  kind: 'text';
  text: string;
  language?: string | undefined;
  truncated?: boolean | undefined;
}

export interface LoadingPreviewData {
  kind: 'loading';
  message?: string | undefined;
}

export interface UnavailablePreviewData {
  kind: 'unavailable';
  reason?: string | undefined;
}

/** Host-safe data that a portable component can render without reading a file. */
export type ArtifactPreviewData =
  | TablePreviewData
  | ImagePreviewData
  | MetricPreviewData
  | TextPreviewData
  | LoadingPreviewData
  | UnavailablePreviewData;

export interface DelimitedPreviewOptions {
  delimiter?: string | undefined;
  maxRows?: number | undefined;
  maxColumns?: number | undefined;
  /** Set when the source text was itself cut short by the host. */
  sourceTruncated?: boolean | undefined;
}

/** RFC 4180-style rows: quoted cells may hold delimiters, doubled quotes, and line breaks. Blank rows are dropped. */
function parseDelimited(text: string, delimiter: string): { rows: string[][]; unterminated: boolean } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => { row.push(cell.trim()); cell = ''; };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (quoted) {
      if (character !== '"') cell += character;
      else if (text.charAt(index + 1) === '"') { cell += '"'; index += 1; } else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) endCell();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text.charAt(index + 1) === '\n') index += 1;
      endRow();
    } else cell += character;
  }
  endRow();
  return { rows, unterminated: quoted };
}

/** Turns delimited text (CSV, TSV) into table preview data. */
export function tablePreviewFromDelimited(text: string, options: DelimitedPreviewOptions = {}): TablePreviewData {
  const delimiter = options.delimiter ?? ',';
  const maxRows = options.maxRows ?? 30;
  const maxColumns = options.maxColumns ?? 30;
  const parsed = parseDelimited(text, delimiter);
  const [allHeaders = [], ...records] = parsed.rows;
  // A byte-limited sample may end inside a record (or inside a quoted cell);
  // that record is dropped, and the total row count is unknown.
  const sampled = Boolean(options.sourceTruncated);
  const lastComplete = /\r?\n$/.test(text) && !parsed.unterminated;
  const body = sampled && !lastComplete ? records.slice(0, -1) : records;
  const headers = allHeaders.slice(0, maxColumns);
  const rows = body.slice(0, maxRows).map((cells) => cells.slice(0, maxColumns));
  return {
    kind: 'table',
    headers,
    rows,
    ...(sampled ? {} : { totalRows: body.length }),
    totalColumns: allHeaders.length,
    truncated: sampled || body.length > maxRows || allHeaders.length > maxColumns,
  };
}

/** Turns an array of flat objects (e.g. parsed JSON records) into table preview data. */
export function tablePreviewFromRows(
  records: readonly Record<string, unknown>[],
  options: Pick<DelimitedPreviewOptions, 'maxRows' | 'maxColumns' | 'sourceTruncated'> = {},
): TablePreviewData {
  const maxRows = options.maxRows ?? 30;
  const maxColumns = options.maxColumns ?? 30;
  const allHeaders = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const headers = allHeaders.slice(0, maxColumns);
  const rows = records.slice(0, maxRows).map((record) => headers.map((header) => {
    const value = record[header];
    if (value == null) return null;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
    return JSON.stringify(value);
  }));
  return {
    kind: 'table',
    headers,
    rows,
    totalRows: records.length,
    totalColumns: allHeaders.length,
    truncated: Boolean(options.sourceTruncated) || records.length > maxRows || allHeaders.length > maxColumns,
  };
}

/** Reads a metric from a scalar or a `{ value, uncertainty?, unit?, label? }` object; `undefined` when the shape is not a metric. */
export function metricPreviewFromJson(value: unknown): MetricPreviewData | undefined {
  if (typeof value === 'number' || typeof value === 'string') return { kind: 'metric', value };
  if (value && typeof value === 'object' && 'value' in value) {
    const record = value as Record<string, unknown>;
    const metric = record.value;
    if (typeof metric !== 'number' && typeof metric !== 'string') return undefined;
    const result: MetricPreviewData = { kind: 'metric', value: metric };
    if (typeof record.uncertainty === 'number' || typeof record.uncertainty === 'string') result.uncertainty = record.uncertainty;
    if (typeof record.unit === 'string') result.unit = record.unit;
    if (typeof record.label === 'string') result.label = record.label;
    return result;
  }
  return undefined;
}
