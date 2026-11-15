import { useCallback, useEffect, useRef, useState } from 'react';
import type { Output } from '@astra-spec/sdk/reports';

/** Full-screen state for an output, reset whenever the output changes (a controlled host is asked to reset). */
export function useOutputExpanded(output: Output, controlled?: { expanded?: boolean | undefined; onExpandedChange?: ((next: boolean) => void) | undefined }) {
  const [internal, setInternal] = useState(false);
  const [lastPath, setLastPath] = useState(output.ref);
  if (lastPath !== output.ref) {
    setLastPath(output.ref);
    setInternal(false);
  }
  const isControlled = controlled?.expanded !== undefined;
  const expanded = isControlled ? Boolean(controlled.expanded) : internal;
  const onChange = controlled?.onExpandedChange;
  const seenPath = useRef(output.ref);
  const controlledExpanded = isControlled && Boolean(controlled.expanded);
  useEffect(() => {
    if (seenPath.current === output.ref) return;
    seenPath.current = output.ref;
    if (controlledExpanded) onChange?.(false);
  }, [output.ref, controlledExpanded, onChange]);
  const setExpanded = useCallback((next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [expanded, setExpanded] as const;
}
