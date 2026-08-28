/* eslint-disable react-hooks/refs, @typescript-eslint/unbound-method --
 * Floating UI intentionally exposes callback refs and middleware ref objects
 * that are passed through during render; none of these APIs read `.current`.
 */
import {
  FloatingArrow,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  arrow,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  size,
  useClientPoint,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  useTransitionStatus,
} from '@floating-ui/react';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';
import { Slot } from '../lib/slot.js';
import { useDialogDismissGuard, useOptionalDialog } from './dialog.js';
import type { SurfaceKind } from './kind.js';

const ARROW_HEIGHT = 7;
const REFERENCE_GAP = 6;
const VIEWPORT_PADDING = 8;

export interface PreviewPopoverPortalProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  'data-astra-color-scheme'?: 'light' | 'dark' | undefined;
  'data-lightcone-color-scheme'?: 'light' | 'dark' | undefined;
}

export interface PreviewPopoverProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  /** A single focusable element. Non-focusable elements receive `tabIndex=0`. */
  trigger: ReactElement;
  children: ReactNode;
  /** Accessible name for the non-modal preview dialog. */
  label: string;
  kind?: SurfaceKind | undefined;
  disabled?: boolean | undefined;
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  openDelay?: number | undefined;
  closeDelay?: number | undefined;
  /** Optional portal mount. The document body is used by default. */
  portalRoot?: HTMLElement | ShadowRoot | null | undefined;
  /** Host scope and scheme attributes belong here because portals do not inherit DOM ancestry. */
  portalProps?: PreviewPopoverPortalProps | undefined;
}

function PreviewPopoverInner({
  trigger,
  children,
  label,
  kind,
  disabled = false,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  openDelay = 120,
  closeDelay = 60,
  portalRoot,
  portalProps,
  className,
  ...props
}: PreviewPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = !disabled && (controlledOpen ?? uncontrolledOpen);
  const nodeId = useFloatingNodeId();
  const contentId = useId();
  const arrowRef = useRef<SVGSVGElement>(null);
  const cursorX = useRef<number | null>(null);
  const [pinnedX, setPinnedX] = useState<number | null>(null);
  const [automaticPortalRoot, setAutomaticPortalRoot] =
    useState<HTMLDialogElement | null | undefined>(undefined);

  const setOpen = useCallback((next: boolean, event?: Event) => {
    if (next) {
      setPinnedX(event instanceof MouseEvent ? cursorX.current : null);
    }
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  const { refs, floatingStyles, context, placement } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement: 'top',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ARROW_HEIGHT + REFERENCE_GAP),
      flip({ padding: VIEWPORT_PADDING }),
      shift({ padding: VIEWPORT_PADDING }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          elements.floating.style.setProperty(
            '--astra-preview-available-height',
            `${Math.max(180, availableHeight)}px`,
          );
        },
      }),
      arrow({ element: arrowRef, padding: VIEWPORT_PADDING }),
    ],
  });

  const hover = useHover(context, {
    enabled: !disabled,
    delay: { open: openDelay, close: closeDelay },
    handleClose: safePolygon({ buffer: 1 }),
    move: false,
  });
  const focus = useFocus(context, { enabled: !disabled });
  const point = useClientPoint(context, {
    enabled: !disabled,
    axis: 'x',
    x: pinnedX,
  });
  const dialog = useOptionalDialog();
  const inModalDialog = dialog?.mode === 'modal';
  useDialogDismissGuard(open && !disabled && inModalDialog, () => {
    setOpen(false);
  });
  const dismiss = useDismiss(context, {
    enabled: !disabled,
    escapeKey: !inModalDialog,
    bubbles: { escapeKey: false },
  });
  const role = useRole(context, { enabled: !disabled, role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    point,
    dismiss,
    role,
  ]);
  const { isMounted, status } = useTransitionStatus(context, {
    duration: { open: 120, close: 80 },
  });
  const setFloatingReference = refs.setReference;
  const setReference = useCallback((element: HTMLElement | null) => {
    setFloatingReference(element);
    const nextRoot = element
      ? (element.closest<HTMLDialogElement>('dialog') ?? null)
      : undefined;
    setAutomaticPortalRoot((currentRoot) =>
      currentRoot === nextRoot ? currentRoot : nextRoot,
    );
  }, [setFloatingReference, setAutomaticPortalRoot]);

  const reference = (
    <Slot
      ref={setReference}
      {...getReferenceProps({
        ...(!disabled
          ? {
              tabIndex: 0,
              'aria-haspopup': 'dialog',
              'aria-expanded': open,
              'aria-controls': open ? contentId : undefined,
            }
          : {}),
        onMouseEnter(event) {
          cursorX.current = event.clientX;
        },
        onMouseMove(event) {
          cursorX.current = event.clientX;
        },
      })}
    >
      {trigger}
    </Slot>
  );

  const portalClassName = cn(
    'astra-ui astra-preview-popover-portal',
    portalProps?.className,
  );
  const resolvedPortalRoot = portalRoot === undefined
    ? (automaticPortalRoot ?? undefined)
    : portalRoot;
  const portalRootReady = portalRoot !== undefined || automaticPortalRoot !== undefined;

  return (
    <>
      {reference}
      <FloatingNode id={nodeId}>
        {isMounted && portalRootReady ? (
          <FloatingPortal root={resolvedPortalRoot} preserveTabOrder>
            <div
              {...portalProps}
              data-slot="preview-popover-portal"
              className={portalClassName}
            >
              <FloatingFocusManager
                context={context}
                modal={false}
                initialFocus={-1}
              >
                <div
                  {...getFloatingProps(props)}
                  id={contentId}
                  ref={refs.setFloating}
                  style={{ ...floatingStyles, ...props.style }}
                  className={cn('astra-preview-popover', className)}
                  aria-label={label}
                  aria-modal="false"
                  data-kind={kind}
                  data-placement={placement}
                  data-status={status}
                  data-slot="preview-popover"
                >
                  <div className="astra-preview-popover__surface">
                    <div className="astra-preview-popover__scroll">{children}</div>
                    <FloatingArrow
                      ref={arrowRef}
                      context={context}
                      className="astra-preview-popover__arrow"
                      height={ARROW_HEIGHT}
                      width={ARROW_HEIGHT * 2}
                    />
                  </div>
                </div>
              </FloatingFocusManager>
            </div>
          </FloatingPortal>
        ) : null}
      </FloatingNode>
    </>
  );
}

/**
 * Cursor-anchored, non-modal preview opened by hover or keyboard focus.
 * The outermost instance creates the Floating UI tree needed by nested previews.
 */
export function PreviewPopover(props: PreviewPopoverProps) {
  const parentId = useFloatingParentNodeId();
  if (parentId === null) {
    return (
      <FloatingTree>
        <PreviewPopoverInner {...props} />
      </FloatingTree>
    );
  }
  return <PreviewPopoverInner {...props} />;
}
