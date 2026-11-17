import { useCallback, useEffect, useRef, useState } from 'react';
import type { Output } from '@astra-spec/sdk/reports';

/**
 * Full-screen state for an output, reset whenever the output or the result it
 * is shown with changes (a controlled host is asked to reset): the same output
 * in another universe is another artifact.
 */
export function useOutputExpanded(
  output: Output,
  controlled?: { expanded?: boolean | undefined; onExpandedChange?: ((next: boolean) => void) | undefined },
  resultId?: string,
) {
  const identity = JSON.stringify([output.ref, resultId]);
  const [internal, setInternal] = useState(false);
  const [lastIdentity, setLastIdentity] = useState(identity);
  if (lastIdentity !== identity) {
    setLastIdentity(identity);
    setInternal(false);
  }
  const isControlled = controlled?.expanded !== undefined;
  const expanded = isControlled ? Boolean(controlled.expanded) : internal;
  const onChange = controlled?.onExpandedChange;
  const seenIdentity = useRef(identity);
  const controlledExpanded = isControlled && Boolean(controlled.expanded);
  useEffect(() => {
    if (seenIdentity.current === identity) return;
    seenIdentity.current = identity;
    if (controlledExpanded) onChange?.(false);
  }, [identity, controlledExpanded, onChange]);
  const setExpanded = useCallback((next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [expanded, setExpanded] as const;
}
