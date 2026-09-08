import { useEffect, useLayoutEffect } from 'react';

/** `useLayoutEffect` in the browser; on the server, where layout effects never run, the silent `useEffect`. */
export const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;
