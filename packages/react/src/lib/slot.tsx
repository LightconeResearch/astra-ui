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
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
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
  const childRef = 'ref' in childProps ? childProps.ref : (element as { ref?: Ref<HTMLElement> }).ref;
  merged.ref = mergeRefs(ref, childRef);
  return cloneElement(element, merged);
});
