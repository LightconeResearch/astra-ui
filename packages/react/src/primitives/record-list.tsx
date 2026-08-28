import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { surfaceGlyph, type SurfaceKind } from './kind.js';

export interface RecordListColumn {
  label?: string | undefined;
  className?: string | undefined;
}

export interface RecordListRow {
  key: string;
  accessibleLabel: string;
  cells: ReactNode[];
  onOpen: () => void;
}

export interface RecordListProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name of the list (announced as a group). */
  label: string;
  columns: RecordListColumn[];
  /** CSS grid template for the row columns. */
  columnTemplate: string;
  rows: RecordListRow[];
}

/** A column-aligned list of clickable record rows. */
export const RecordList = forwardRef<HTMLDivElement, RecordListProps>(function RecordList({
  label,
  columns,
  columnTemplate,
  rows,
  className,
  style,
  ...props
}, ref) {
  const gridStyle = { ...style, '--astra-record-columns': columnTemplate } as CSSProperties;
  return (
    <div
      data-slot="record-list"
      {...props}
      ref={ref}
      className={cn('astra-record-list', className)}
      role="group"
      aria-label={label}
      style={gridStyle}
    >
      <div className="astra-record-list__head" aria-hidden="true">
        {columns.map((column, index) => (
          <span key={`${column.label ?? 'blank'}-${index}`} className={column.className}>
            {column.label}
          </span>
        ))}
      </div>
      <div className="astra-record-list__body">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            aria-label={row.accessibleLabel}
            onClick={row.onOpen}
          >
            {row.cells.map((cell, index) => (
              <span key={index} className={columns[index]?.className}>{cell}</span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
});

export interface RecordIdentityProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'title'> {
  kind: SurfaceKind;
  title: ReactNode;
  subtitle?: ReactNode | undefined;
}

/** Glyph, title, and optional subtitle for a record row. */
export const RecordIdentity = forwardRef<HTMLSpanElement, RecordIdentityProps>(function RecordIdentity({
  kind,
  title,
  subtitle,
  className,
  ...props
}, ref) {
  return (
    <span data-slot="record-identity" {...props} ref={ref} className={cn('astra-record-list__name', className)}>
      <span className="astra-record-list__glyph" data-kind={kind} aria-hidden="true">
        {surfaceGlyph(kind)}
      </span>
      <span>
        <strong>{title}</strong>
        {subtitle != null ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
});

export const EmptyState = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function EmptyState({ className, ...props }, ref) {
    return <p data-slot="empty-state" {...props} ref={ref} className={cn('astra-empty-state', className)} />;
  },
);
