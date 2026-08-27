import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { IconButton } from './button.js';
import { Slot } from '../lib/slot.js';
import type { SurfaceKind } from './kind.js';
import { SurfaceHeader, type SurfaceHeadingLevel } from './surface-header.js';

export type DialogMode = 'modal' | 'embedded';
export type DialogLayout = 'single' | 'reader';

/* ------------------------------------------------------------------ */
/* Presentation defaults shared by a subtree (mode, back trail)         */
/* ------------------------------------------------------------------ */

interface DialogPresentation {
  mode?: DialogMode | undefined;
  backLabel?: string | undefined;
  backText?: string | undefined;
}

const PresentationContext = createContext<DialogPresentation>({});

export interface DialogProviderProps extends DialogPresentation {
  children: ReactNode;
}

/**
 * Sets the default mode (modal or embedded) and back-trail text for every
 * Dialog below it. Explicit props on a Dialog still win.
 */
export function DialogProvider({ mode, backLabel, backText, children }: DialogProviderProps) {
  const value = useMemo(() => ({ mode, backLabel, backText }), [mode, backLabel, backText]);
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Dialog root                                                          */
/* ------------------------------------------------------------------ */

interface DialogContextValue {
  open: boolean;
  mode: DialogMode;
  kind: SurfaceKind | undefined;
  layout: DialogLayout | undefined;
  titleId: string;
  backLabel: string;
  backText: string | undefined;
  requestClose: () => void;
  /** Registers a dismissal guard; returns the release function. */
  addGuard: () => () => void;
  isGuarded: () => boolean;
  closeRef: Ref<HTMLButtonElement>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value) throw new Error('Dialog parts must be rendered inside <Dialog>.');
  return value;
}

export interface DialogProps {
  /** Mounting a Dialog opens it; pass `false` to keep it mounted but closed. */
  open?: boolean | undefined;
  /** Called with `false` when the user dismisses the dialog (Escape, backdrop, close button). */
  onOpenChange?: ((open: boolean) => void) | undefined;
  mode?: DialogMode | undefined;
  kind?: SurfaceKind | undefined;
  layout?: DialogLayout | undefined;
  backLabel?: string | undefined;
  backText?: string | undefined;
  children: ReactNode;
}

export function Dialog({
  open = true,
  onOpenChange,
  mode,
  kind,
  layout,
  backLabel,
  backText,
  children,
}: DialogProps) {
  const presentation = useContext(PresentationContext);
  const labels = useLabels();
  const titleId = useId();
  const guards = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestClose = useCallback(() => onOpenChange?.(false), [onOpenChange]);
  const addGuard = useCallback(() => {
    guards.current += 1;
    return () => { guards.current -= 1; };
  }, []);
  const isGuarded = useCallback(() => guards.current > 0, []);
  const value = useMemo<DialogContextValue>(() => ({
    open,
    mode: mode ?? presentation.mode ?? 'modal',
    kind,
    layout,
    titleId,
    backLabel: backLabel ?? presentation.backLabel ?? labels.backTo,
    backText: backText ?? presentation.backText,
    requestClose,
    addGuard,
    isGuarded,
    closeRef,
  }), [open, mode, presentation, kind, layout, titleId, backLabel, backText, labels.backTo, requestClose, addGuard, isGuarded]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

/**
 * Registers a dismissal guard while `active`: Escape and backdrop clicks are
 * ignored so an inner layer (e.g. a full-screen artifact) can consume them.
 * Safe to call outside a Dialog.
 */
export function useDialogDismissGuard(active: boolean): void {
  const context = useContext(DialogContext);
  const addGuard = context?.addGuard;
  useEffect(() => {
    if (!active || !addGuard) return undefined;
    return addGuard();
  }, [active, addGuard]);
}

/* ------------------------------------------------------------------ */
/* Content: the <dialog> (modal) or <div> (embedded) plus the panel     */
/* ------------------------------------------------------------------ */

export interface DialogContentProps extends HTMLAttributes<HTMLElement> {
  /** Class name for the inner panel; the root receives `className`. */
  panelClassName?: string | undefined;
  /** Element focused when the dialog opens; defaults to the close button. */
  initialFocusRef?: Ref<HTMLElement> | undefined;
}

export const DialogContent = forwardRef<HTMLElement, DialogContentProps>(function DialogContent({
  className,
  panelClassName,
  initialFocusRef,
  children,
  onMouseDown,
  ...props
}, ref) {
  const { open, mode, kind, layout, titleId, requestClose, isGuarded, closeRef } = useDialog();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const setRefs = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useEffect(() => {
    if (mode !== 'modal') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const target = initialFocusRef && typeof initialFocusRef !== 'function'
        ? initialFocusRef.current
        : null;
      (target ?? (closeRef as { current: HTMLButtonElement | null }).current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, mode, initialFocusRef, closeRef]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!isGuarded()) requestClose();
  };
  const handleClose = () => {
    if (open) requestClose();
  };
  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if (event.target === event.currentTarget && !isGuarded()) requestClose();
  };

  const data = {
    'data-slot': 'dialog',
    'data-mode': mode,
    ...(kind ? { 'data-kind': kind } : {}),
    ...(layout ? { 'data-layout': layout } : {}),
  };
  const panel = (
    <section
      data-slot="dialog-panel"
      className={cn('astra-dialog__panel', panelClassName)}
      {...(kind ? { 'data-kind': kind } : {})}
      aria-labelledby={titleId}
    >
      {children}
    </section>
  );

  if (mode === 'embedded') {
    return (
      <div {...props} {...data} ref={ref as Ref<HTMLDivElement>} className={cn('astra-dialog', className)}>
        {panel}
      </div>
    );
  }
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop click dismisses the modal
    <dialog
      {...props}
      {...data}
      ref={setRefs}
      className={cn('astra-dialog', className)}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      onMouseDown={handleMouseDown}
    >
      {panel}
    </dialog>
  );
});

/* ------------------------------------------------------------------ */
/* Header and body parts                                                */
/* ------------------------------------------------------------------ */

export interface DialogHeaderProps {
  /** Short kind label shown in the trail (e.g. "Decision"). */
  kindLabel?: ReactNode | undefined;
  title: ReactNode;
  titleAs?: SurfaceHeadingLevel | undefined;
  identifier?: ReactNode | undefined;
  /** Renders the back control; the trail text comes from Dialog/DialogProvider `backText`. */
  onBack?: (() => void) | undefined;
  /** Extra controls rendered before the close button. */
  actions?: ReactNode | undefined;
  closeLabel?: string | undefined;
  showCloseButton?: boolean | undefined;
  className?: string | undefined;
}

export function DialogHeader({
  kindLabel,
  title,
  titleAs = 'h3',
  identifier,
  onBack,
  actions,
  closeLabel,
  showCloseButton = true,
  className,
}: DialogHeaderProps) {
  const { kind, titleId, backText, requestClose, closeRef } = useDialog();
  const labels = useLabels();
  return (
    <SurfaceHeader
      data-slot="dialog-header"
      className={cn('astra-dialog__header', className)}
      classNames={{ actions: 'astra-dialog__actions' }}
      kind={kind}
      density="compact"
      leading={onBack ? <DialogBack onClick={onBack} /> : undefined}
      eyebrow={(
        <span data-slot="dialog-trail" className="astra-dialog__trail">
          {onBack && backText ? (
            <>
              <span className="astra-dialog__crumb">{backText}</span>
              <span className="astra-dialog__trail-separator" aria-hidden="true">▸</span>
            </>
          ) : null}
          {kindLabel != null ? <span data-slot="dialog-kind" className="astra-dialog__kind">{kindLabel}</span> : null}
        </span>
      )}
      title={title}
      titleId={titleId}
      titleAs={titleAs}
      identifier={identifier}
      actions={(
        <>
          {actions}
          {showCloseButton ? (
            <IconButton
              ref={closeRef}
              data-slot="dialog-close"
              label={closeLabel ?? labels.close}
              onClick={requestClose}
              title={labels.close}
            >
              ×
            </IconButton>
          ) : null}
        </>
      )}
    />
  );
}

export function DialogBack({ onClick, className }: { onClick: () => void; className?: string | undefined }) {
  const { backLabel } = useDialog();
  const labels = useLabels();
  return (
    <IconButton
      data-slot="dialog-back"
      className={cn('astra-dialog__back', className)}
      label={backLabel}
      onClick={onClick}
      title={labels.back}
    >
      <span aria-hidden="true">←</span>
    </IconButton>
  );
}

export interface DialogActionProps extends HTMLAttributes<HTMLElement> {
  /** Render the child (e.g. an `<a>`) instead of a `<button>`. */
  asChild?: boolean | undefined;
}

/** A text action for the dialog header (e.g. "Open ↗"); pass `asChild` to render a link. */
export const DialogAction = forwardRef<HTMLElement, DialogActionProps>(function DialogAction({ asChild = false, className, ...props }, ref) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      {...props}
      {...(asChild ? {} : { type: 'button' })}
      ref={ref as never}
      data-slot="dialog-action"
      className={cn('astra-dialog__action', className)}
    />
  );
});

export const DialogBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DialogBody({ className, ...props }, ref) {
  return <div {...props} ref={ref} data-slot="dialog-body" className={cn('astra-dialog__body', className)} />;
});

/* ------------------------------------------------------------------ */
/* Preset: the record detail shell                                      */
/* ------------------------------------------------------------------ */

export interface DetailDialogProps extends Omit<DialogProps, 'children' | 'onOpenChange' | 'open'> {
  kindLabel?: ReactNode | undefined;
  title: ReactNode;
  titleAs?: SurfaceHeadingLevel | undefined;
  identifier?: ReactNode | undefined;
  onBack?: (() => void) | undefined;
  actions?: ReactNode | undefined;
  closeLabel?: string | undefined;
  onClose: () => void;
  className?: string | undefined;
  panelClassName?: string | undefined;
  children: ReactNode;
}

/**
 * Dialog + DialogContent + DialogHeader + DialogBody with the record-detail
 * chrome. Every kind dialog and the inventory explorer build on this; hosts
 * that need a different header compose the parts directly.
 */
export function DetailDialog({
  kindLabel,
  title,
  titleAs,
  identifier,
  onBack,
  actions,
  closeLabel,
  onClose,
  className,
  panelClassName,
  children,
  ...dialog
}: DetailDialogProps) {
  return (
    <Dialog {...dialog} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={className} panelClassName={panelClassName}>
        <DialogHeader
          kindLabel={kindLabel}
          title={title}
          titleAs={titleAs}
          identifier={identifier}
          onBack={onBack}
          actions={actions}
          closeLabel={closeLabel}
        />
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}
