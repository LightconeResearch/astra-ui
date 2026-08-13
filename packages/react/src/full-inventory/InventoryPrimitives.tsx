import type { CSSProperties, ReactNode, Ref } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
} from 'react';
import { IconButton, SurfaceHeader } from '../ui.js';
import type { InventoryKind } from '../types.js';

export interface InventoryListColumn {
  label?: string | undefined;
  className?: string | undefined;
}

export interface InventoryListRow {
  key: string;
  accessibleLabel: string;
  cells: ReactNode[];
  onOpen: () => void;
}

const INVENTORY_GLYPHS: Record<InventoryKind | 'paper' | 'file', string> = {
  analysis: '◐',
  input: '↳',
  decision: '◇',
  output: '◆',
  finding: '●',
  prior_insight: '◈',
  paper: '▧',
  file: '▱',
};

export function InventoryRecordIdentity({
  kind,
  title,
  subtitle,
  className,
}: {
  kind: InventoryKind | 'paper' | 'file';
  title: ReactNode;
  subtitle?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <span className={`inventory-record-list__name${className ? ` ${className}` : ''}`}>
      <span className="inventory-record-list__glyph" data-kind={kind} aria-hidden="true">
        {INVENTORY_GLYPHS[kind]}
      </span>
      <span>
        <strong>{title}</strong>
        {subtitle != null ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
}

export function InventoryEmptyState({ children, className }: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <p className={`inventory-record-empty${className ? ` ${className}` : ''}`}>
      {children}
    </p>
  );
}

interface InventoryRecordListProps {
  ariaLabel: string;
  columns: InventoryListColumn[];
  columnTemplate: string;
  rows: InventoryListRow[];
}

type InventoryListStyle = CSSProperties & {
  '--inventory-record-columns': string;
};

export function InventoryRecordList({
  ariaLabel,
  columns,
  columnTemplate,
  rows,
}: InventoryRecordListProps) {
  const style: InventoryListStyle = { '--inventory-record-columns': columnTemplate };
  return (
    <div className="inventory-record-list" aria-label={ariaLabel} style={style}>
      <div className="inventory-record-list__head" aria-hidden="true">
        {columns.map((column, index) => (
          <span key={`${column.label ?? 'blank'}-${index}`} className={column.className}>
            {column.label}
          </span>
        ))}
      </div>
      <div className="inventory-record-list__body">
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
}

export interface InventoryDetailSurfaceProps {
  className?: string | undefined;
  kind?: InventoryKind | 'paper' | 'file' | undefined;
  eyebrow: string;
  title: string;
  identifier?: string | undefined;
  backLabel?: string | undefined;
  backText?: string | undefined;
  onBack?: (() => void) | undefined;
  headerActions?: ReactNode | undefined;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  closeRef?: Ref<HTMLButtonElement> | undefined;
  titleId?: string | undefined;
}

export type InventoryDetailMode = 'modal' | 'embedded';

interface InventoryDetailPresentationValue {
  mode: InventoryDetailMode;
  backLabel?: string | undefined;
  backText?: string | undefined;
}

const InventoryDetailModeContext = createContext<InventoryDetailPresentationValue>({
  mode: 'modal',
});

export function InventoryDetailPresentation({
  mode,
  backLabel,
  backText,
  children,
}: {
  mode: InventoryDetailMode;
  backLabel?: string | undefined;
  backText?: string | undefined;
  children: ReactNode;
}) {
  return (
    <InventoryDetailModeContext.Provider value={{ mode, backLabel, backText }}>
      {children}
    </InventoryDetailModeContext.Provider>
  );
}

/**
 * Presentational detail frame shared by modal and embedded hosts.
 *
 * InventoryDetailDialog owns modal focus and dismissal behavior. This surface
 * owns only the exact header, actions, and body presentation.
 */
export function InventoryDetailSurface({
  className,
  kind,
  eyebrow,
  title,
  backLabel = 'Back to previous record',
  backText,
  onBack,
  headerActions,
  closeLabel,
  onClose,
  children,
  closeRef,
  titleId,
}: InventoryDetailSurfaceProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const typeLabel = eyebrow.split(' · ', 1)[0] ?? eyebrow;

  return (
    <section
      className={className}
      data-kind={kind}
      role="region"
      aria-labelledby={resolvedTitleId}
    >
      <SurfaceHeader
        className="inventory-detail-dialog__header"
        actionsClassName="inventory-detail-dialog__actions"
        kind={kind}
        leading={onBack ? (
          <IconButton
            className="inventory-detail-dialog__back"
            label={backLabel}
            onClick={onBack}
            title="Back"
          >
            <span aria-hidden="true">←</span>
          </IconButton>
        ) : undefined}
        eyebrow={(
          <span className="inventory-detail-dialog__trail">
            {onBack && backText ? (
              <>
                <span className="inventory-detail-dialog__crumb">{backText}</span>
                <span className="inventory-detail-dialog__trail-separator" aria-hidden="true">▸</span>
              </>
            ) : null}
            <span className="inventory-detail-dialog__kind">{typeLabel}</span>
          </span>
        )}
        title={title}
        titleId={resolvedTitleId}
        titleAs="h3"
        density="compact"
        actions={(
          <>
            {headerActions}
            <IconButton
              ref={closeRef}
              label={closeLabel}
              onClick={onClose}
              title="Close all details"
            >
              ×
            </IconButton>
          </>
        )}
      />
      <div className="inventory-detail-dialog__body">{children}</div>
    </section>
  );
}

interface InventoryDetailDialogProps extends Omit<
  InventoryDetailSurfaceProps,
  'closeRef' | 'titleId'
> {}

export function InventoryDetailDialog({
  className,
  ...props
}: InventoryDetailDialogProps) {
  const presentation = useContext(InventoryDetailModeContext);
  const { mode } = presentation;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      props.onClose();
    }
  }, [props.onClose]);

  useEffect(() => {
    if (mode === 'embedded') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, [mode]);

  if (mode === 'embedded') {
    return (
      <div
        className={`inventory-detail-dialog inventory-detail-dialog--embedded${className ? ` ${className}` : ''}`}
      >
        <InventoryDetailSurface
          {...props}
          backLabel={presentation.backLabel ?? props.backLabel}
          backText={presentation.backText ?? props.backText}
          titleId={titleId}
          onClose={props.onClose}
        />
      </div>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className={`inventory-detail-dialog${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClose={props.onClose}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <InventoryDetailSurface
        {...props}
        backLabel={presentation.backLabel ?? props.backLabel}
        backText={presentation.backText ?? props.backText}
        closeRef={closeRef}
        titleId={titleId}
        onClose={requestClose}
      />
    </dialog>
  );
}

export function InventoryDetailLayout({ children, className }: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={`inventory-record-detail__layout${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

export function InventoryDetailMain({ children, as = 'div' }: {
  children: ReactNode;
  as?: 'div' | 'main' | undefined;
}) {
  const Component = as;
  return <Component className="inventory-record-detail__main">{children}</Component>;
}

export function InventoryDetailRail({ children, label }: {
  children: ReactNode;
  label: string;
}) {
  return (
    <aside className="inventory-record-detail__aside" aria-label={label}>
      {children}
    </aside>
  );
}

export function InventoryDetailProse({ label, children, className }: {
  label: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={`inventory-record-detail__prose${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <div>{children}</div>
    </section>
  );
}

export function InventoryCountHeading({ title, count }: {
  title: ReactNode;
  count: number;
}) {
  return <h4 className="inventory-count-heading">{title} <span>{count}</span></h4>;
}
