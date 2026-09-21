/* eslint-disable react-hooks/refs, @typescript-eslint/unbound-method -- Floating UI uses callback refs during render. */
import {
  FloatingPortal, autoUpdate, flip, offset, shift,
  useDismiss, useFloating, useFocus, useHover, useInteractions, useRole,
} from '@floating-ui/react';
import { useCallback, useState, type ReactElement } from 'react';
import { Slot } from './slot.js';

/** A small, non-interactive explanation. Preserves the trigger's tab order. */
export function Tooltip({ children, content }: { children: ReactElement; content: string }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const hover = useHover(context, { move: false, delay: { open: 150, close: 100 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const setFloatingReference = refs.setReference;
  // Preserve host theme tokens and native-dialog stacking, outside clipped previews.
  const setReference = useCallback((element: HTMLElement | null) => {
    setFloatingReference(element);
    setPortalRoot(element?.closest<HTMLElement>('dialog, .astra-ui') ?? null);
  }, [setFloatingReference]);
  return (
    <>
      <Slot ref={setReference} {...getReferenceProps()}>{children}</Slot>
      {open ? (
        <FloatingPortal root={portalRoot ?? undefined}>
          <div className={portalRoot ? undefined : 'astra-ui'}>
            <div
              {...getFloatingProps()}
              ref={refs.setFloating}
              style={floatingStyles}
              className="astra-tooltip"
            >
              {content}
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
