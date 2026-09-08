import { Children, cloneElement, forwardRef, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import type { SurfaceKind } from '../model/kind.js';
import { cn } from '../lib/cn.js';
import { Slot } from './slot.js';
import { KindGlyph } from './kind-glyph.js';

export interface InlineReferenceProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: SurfaceKind | 'value' | 'option' | undefined;
  asChild?: boolean | undefined;
}

/** Editorial inline token. Hosts own its text, navigation and preview interaction. */
export const InlineReference = forwardRef<HTMLSpanElement, InlineReferenceProps>(function InlineReference({
  kind, asChild = false, className, children, ...props
}, ref) {
  const Component = asChild ? Slot : 'span';
  const glyph = kind && kind !== 'value' ? <KindGlyph kind={kind === 'option' ? 'decision' : kind} /> : null;
  const child = asChild ? Children.only(children) as ReactElement<{ children?: ReactNode }> : undefined;
  const content = child ? cloneElement(child, {}, glyph, child.props.children) : <>{glyph}{children}</>;
  return (
    <Component data-slot="inline-reference" {...props} ref={ref} className={cn('astra-ui astra-inline-reference', className)} data-kind={kind}>
      {content}
    </Component>
  );
});
