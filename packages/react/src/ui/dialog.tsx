import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
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
import { Slot } from '../lib/slot.js';
import { IconButton } from './button.js';
import type { SurfaceKind } from './kind.js';
import { SurfaceHeader, type SurfaceHeadingLevel } from './surface-header.js';

export type DialogMode = 'modal' | 'embedded';
export type DialogLayout = 'single' | 'reader';

const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

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
 * Dialog below it. Nested providers inherit what they do not set; explicit
 * props on a Dialog still win.
 */
export function DialogProvider({ mode, backLabel, backText, children }: DialogProviderProps) {
  const parent = useContext(PresentationContext);
  const value = useMemo<DialogPresentation>(() => ({
    mode: mode ?? parent.mode,
    backLabel: backLabel ?? parent.backLabel,
    backText: backText ?? parent.backText,
  }), [mode, backLabel, backText, parent]);
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* Dialog root                                                          */
/* ------------------------------------------------------------------ */

export interface DialogContextValue {
  open: boolean;
  mode: DialogMode;
  kind: SurfaceKind | undefined;
  layout: DialogLayout | undefined;
  titleId: string;
  backLabel: string;
  backText: string | undefined;
  /** Dismisses the dialog: runs the native close (modal), which then notifies `onOpenChange(false)`. */
  requestClose: () => void;
  /** Reports a state change to the host; DialogContent calls it from the native `close` event. */
  notifyOpenChange: (open: boolean) => void;
  /** Registers a dismissal guard; returns the release function. */
  addGuard: () => () => void;
  isGuarded: () => boolean;
  /** DialogContent registers the native close steps here so `requestClose` can run them. */
  registerNativeClose: (close: (() => boolean) | null) => void;
  closeRef: { current: HTMLButtonElement | null };
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
  const nativeClose = useRef<(() => boolean) | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => { onOpenChangeRef.current = onOpenChange; });

  const notifyOpenChange = useCallback((next: boolean) => { onOpenChangeRef.current?.(next); }, []);
  // The native close steps restore focus to the opener and fire `close`,
  // which relays the change; fall back to the callback when there is no
  // open <dialog> (embedded mode, or already closed).
  const requestClose = useCallback(() => {
    if (!nativeClose.current?.()) notifyOpenChange(false);
  }, [notifyOpenChange]);
  const addGuard = useCallback(() => {
    guards.current += 1;
    return () => { guards.current -= 1; };
  }, []);
  const isGuarded = useCallback(() => guards.current > 0, []);
  const registerNativeClose = useCallback((close: (() => boolean) | null) => { nativeClose.current = close; }, []);

  const value = useMemo<DialogContextValue>(() => ({
    open,
    mode: mode ?? presentation.mode ?? 'modal',
    kind,
    layout,
    titleId,
    backLabel: backLabel ?? presentation.backLabel ?? labels.backTo,
    backText: backText ?? presentation.backText,
    requestClose,
    notifyOpenChange,
    addGuard,
    isGuarded,
    registerNativeClose,
    closeRef,
  }), [open, mode, presentation, kind, layout, titleId, backLabel, backText, labels.backTo, requestClose, notifyOpenChange, addGuard, isGuarded, registerNativeClose]);
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
  initialFocusRef?: { current: HTMLElement | null } | undefined;
}

export const DialogContent = forwardRef<HTMLElement, DialogContentProps>(function DialogContent({
  className,
  panelClassName,
  initialFocusRef,
  children,
  onMouseDown,
  ...props
}, ref) {
  const { open, mode, kind, layout, titleId, requestClose, notifyOpenChange, isGuarded, registerNativeClose, closeRef } = useDialog();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // The element that had focus when the dialog opened; focus returns to it on
  // close (browsers do this for showModal() too, but not every environment).
  const openerRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    const opener = openerRef.current;
    openerRef.current = null;
    const active = document.activeElement;
    if (opener?.isConnected && (!active || active === document.body || dialogRef.current?.contains(active))) opener.focus();
  }, []);
  const setRefs = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  // Let the root's requestClose run the native close steps.
  useIsomorphicLayoutEffect(() => {
    registerNativeClose(() => {
      const dialog = dialogRef.current;
      if (mode !== 'modal' || !dialog?.open) return false;
      dialog.close();
      return true;
    });
    return () => { registerNativeClose(null); };
  }, [mode, registerNativeClose]);

  // Open/close the native dialog to match `open`.
  useIsomorphicLayoutEffect(() => {
    if (mode !== 'modal') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      (initialFocusRef?.current ?? closeRef.current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, mode, initialFocusRef, closeRef]);

  // Closing on unmount keeps the browser's focus restoration: close()
  // returns focus to the element that opened the dialog, removal does not.
  useIsomorphicLayoutEffect(() => () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    restoreFocus();
  }, [restoreFocus]);

  // When the body swaps (drill-down/back) and the focused element went away,
  // keep focus inside the dialog rather than letting it fall to <body>.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (mode !== 'modal' || !dialog?.open) return;
    const active = document.activeElement;
    if (!active || active === document.body || !dialog.contains(active)) closeRef.current?.focus();
  });

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Guarded: an inner layer owns Escape. Otherwise close explicitly, which
    // is deterministic across browsers (Chromium makes a repeated Escape
    // non-cancelable) and test environments.
    event.preventDefault();
    if (!isGuarded()) requestClose();
  };
  const handleClose = () => {
    restoreFocus();
    if (open) notifyOpenChange(false);
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
    if (!open) return null;
    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- host handler passthrough only
      <div {...props} {...data} ref={ref as Ref<HTMLDivElement>} className={cn('astra-dialog', className)} onMouseDown={onMouseDown}>
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
  const { kind, titleId, backText } = useDialog();
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
          {showCloseButton ? <DialogClose label={closeLabel} /> : null}
        </>
      )}
    />
  );
}

export interface DialogCloseProps {
  /** Accessible name; defaults to the labels' close text. */
  label?: string | undefined;
  className?: string | undefined;
}

/** The dialog's close control; dismisses through the Dialog root. */
export function DialogClose({ label, className }: DialogCloseProps) {
  const { requestClose, closeRef } = useDialog();
  const labels = useLabels();
  return (
    <IconButton
      ref={closeRef}
      data-slot="dialog-close"
      className={className}
      label={label ?? labels.close}
      onClick={requestClose}
      title={labels.close}
    >
      ×
    </IconButton>
  );
}

export interface DialogBackProps {
  onClick: () => void;
  className?: string | undefined;
}

export function DialogBack({ onClick, className }: DialogBackProps) {
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

export interface DetailDialogProps extends Omit<DialogProps, 'children' | 'onOpenChange'> {
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
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const onOpenChange = useCallback((open: boolean) => { if (!open) onCloseRef.current(); }, []);
  return (
    <Dialog {...dialog} onOpenChange={onOpenChange}>
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
