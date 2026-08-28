import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from './cn.js';

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

type SlottableElement = ReactElement<Record<string, unknown> & { ref?: Ref<HTMLElement> }>;

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (value: T | null) => {
    // React 19 callback refs may return a cleanup; when any does, return one
    // cleanup that runs them and detaches the others instead of letting React
    // call this ref again with null.
    const cleanups = refs.map((ref): unknown => {
      if (typeof ref === 'function') {
        const callback: (instance: T | null) => unknown = ref;
        return callback(value);
      }
      if (ref) (ref as { current: T | null }).current = value;
      return undefined;
    });
    if (!cleanups.some((cleanup) => typeof cleanup === 'function')) return undefined;
    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index];
        if (typeof cleanup === 'function') (cleanup as () => void)();
        else if (typeof ref === 'function') ref(null);
        else if (ref) (ref as { current: T | null }).current = null;
      });
    };
  };
}

/**
 * The child's own ref across React versions. React 18 keeps it on the
 * element and, in development, defines a warning getter `props.ref`;
 * React 19 keeps it in `props` and warns on `element.ref`. Only the real one
 * is read, so neither build logs nor drops the ref.
 */
function elementRef(element: SlottableElement): Ref<HTMLElement> | undefined {
  const isWarning = (target: object) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- the getter is inspected for React's warning flag, never called
    const getter = Object.getOwnPropertyDescriptor(target, 'ref')?.get;
    return Boolean(getter && 'isReactWarning' in getter && getter.isReactWarning);
  };
  if (isWarning(element.props)) return (element as { ref?: Ref<HTMLElement> }).ref;
  if (isWarning(element)) return element.props.ref;
  return element.props.ref ?? (element as { ref?: Ref<HTMLElement> }).ref;
}

/**
 * Renders its single child with the slot's props merged in (the `asChild`
 * pattern): class names are concatenated, event handlers are composed, and
 * refs are forwarded. Used by Button and the dialog parts.
 */
export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot({ children, ...props }, ref) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const element = child as SlottableElement;
  const childProps = element.props;
  const merged: Record<string, unknown> = { ...props };
  for (const [key, value] of Object.entries(childProps)) {
    // A child prop set to undefined does not erase the slot's prop.
    if (value === undefined) continue;
    const slotValue = merged[key];
    if (key === 'className') merged[key] = cn(slotValue as string | undefined, value as string | undefined);
    else if (key === 'style') merged[key] = { ...(slotValue as object | undefined), ...(value as object) };
    else if (/^on[A-Z]/.test(key) && typeof slotValue === 'function' && typeof value === 'function') {
      merged[key] = (...args: unknown[]) => {
        (value as (...a: unknown[]) => void)(...args);
        (slotValue as (...a: unknown[]) => void)(...args);
      };
    } else merged[key] = value;
  }
  merged.ref = mergeRefs(ref, elementRef(element));
  return cloneElement(element, merged);
});
