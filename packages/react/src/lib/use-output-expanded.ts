import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedOutput } from '@astra-spec/sdk';

/** Full-screen state for an output, reset whenever the output changes (a controlled host is asked to reset). */
export function useOutputExpanded(output: ResolvedOutput, controlled?: { expanded?: boolean | undefined; onExpandedChange?: ((next: boolean) => void) | undefined }) {
  const [internal, setInternal] = useState(false);
  const [lastPath, setLastPath] = useState(output.canonicalPath);
  if (lastPath !== output.canonicalPath) {
    setLastPath(output.canonicalPath);
    setInternal(false);
  }
  const isControlled = controlled?.expanded !== undefined;
  const expanded = isControlled ? Boolean(controlled.expanded) : internal;
  const onChange = controlled?.onExpandedChange;
  const seenPath = useRef(output.canonicalPath);
  const controlledExpanded = isControlled && Boolean(controlled.expanded);
  useEffect(() => {
    if (seenPath.current === output.canonicalPath) return;
    seenPath.current = output.canonicalPath;
    if (controlledExpanded) onChange?.(false);
  }, [output.canonicalPath, controlledExpanded, onChange]);
  const setExpanded = useCallback((next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [expanded, setExpanded] as const;
}
