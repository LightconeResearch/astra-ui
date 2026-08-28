import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import type { SurfaceKind } from './kind.js';

export type SurfaceHeaderDensity = 'compact' | 'regular' | 'inline';
export type SurfaceHeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

export interface SurfaceHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  leading?: ReactNode | undefined;
  eyebrow?: ReactNode | undefined;
  title?: ReactNode | undefined;
  titleId?: string | undefined;
  titleAs?: SurfaceHeadingLevel | undefined;
  identifier?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  density?: SurfaceHeaderDensity | undefined;
  kind?: SurfaceKind | undefined;
  /** Class names for the header's parts; every part also carries a `data-slot`. */
  classNames?: {
    leading?: string | undefined;
    content?: string | undefined;
    eyebrow?: string | undefined;
    title?: string | undefined;
    identifier?: string | undefined;
    actions?: string | undefined;
  } | undefined;
}

/**
 * Titled header for details, popovers, and inline artifact metadata:
 * leading slot, eyebrow, title, identifier, and trailing actions. Layout only;
 * interaction belongs to the surface that owns it.
 */
export const SurfaceHeader = forwardRef<HTMLElement, SurfaceHeaderProps>(function SurfaceHeader({
  leading,
  eyebrow,
  title,
  titleId,
  titleAs = 'h2',
  identifier,
  actions,
  className,
  classNames,
  density = 'regular',
  kind,
  ...props
}, ref) {
  const Heading = titleAs;
  return (
    <header
      data-slot="surface-header"
      {...props}
      ref={ref}
      className={cn('astra-surface-header', className)}
      data-density={density}
      {...(kind ? { 'data-kind': kind } : {})}
    >
      {leading != null ? (
        <div data-slot="surface-header-leading" className={cn('astra-surface-header__leading', classNames?.leading)}>
          {leading}
        </div>
      ) : null}
      <div data-slot="surface-header-content" className={cn('astra-surface-header__content', classNames?.content)}>
        {eyebrow != null ? (
          <div data-slot="surface-header-eyebrow" className={cn('astra-surface-header__eyebrow', classNames?.eyebrow)}>
            {eyebrow}
          </div>
        ) : null}
        {title != null ? (
          <Heading id={titleId} data-slot="surface-header-title" className={cn('astra-surface-header__title', classNames?.title)}>
            {title}
          </Heading>
        ) : null}
        {identifier != null ? (
          <code data-slot="surface-header-identifier" className={cn('astra-surface-header__identifier', classNames?.identifier)}>
            {identifier}
          </code>
        ) : null}
      </div>
      {actions != null ? (
        <div data-slot="surface-header-actions" className={cn('astra-surface-header__actions', classNames?.actions)}>
          {actions}
        </div>
      ) : null}
    </header>
  );
});
