import type { ResolvedRecord } from '@astra-spec/sdk';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export type SurfaceKind = ResolvedRecord['kind'] | 'analysis' | 'paper';

const SURFACE_GLYPHS: Record<SurfaceKind, string> = {
  analysis: '◐',
  input: '↳',
  decision: '◇',
  output: '◆',
  finding: '●',
  prior_insight: '◈',
  paper: '▧',
};

export function surfaceGlyph(kind: SurfaceKind): string {
  return SURFACE_GLYPHS[kind];
}

export type SurfaceHeaderDensity = 'compact' | 'regular' | 'inline';
export type SurfaceHeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

function classes(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export interface SurfaceHeaderProps {
  leading?: ReactNode | undefined;
  eyebrow?: ReactNode | undefined;
  title?: ReactNode | undefined;
  titleId?: string | undefined;
  titleAs?: SurfaceHeadingLevel | undefined;
  identifier?: ReactNode | undefined;
  identifierClassName?: string | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
  actionsClassName?: string | undefined;
  density?: SurfaceHeaderDensity | undefined;
  kind?: SurfaceKind | undefined;
}

/**
 * Shared visual header for titled details, compact popovers, and inline
 * artifact metadata. Interaction remains owned by the surrounding surface.
 */
export function SurfaceHeader({
  leading,
  eyebrow,
  title,
  titleId,
  titleAs = 'h2',
  identifier,
  identifierClassName,
  actions,
  className,
  actionsClassName,
  density = 'regular',
  kind,
}: SurfaceHeaderProps) {
  const Heading = titleAs;
  return (
    <header
      className={classes('astra-surface-header', className)}
      data-density={density}
      {...(kind ? { 'data-kind': kind } : {})}
    >
      {leading != null ? (
        <div className="astra-surface-header__leading">{leading}</div>
      ) : null}
      <div className="astra-surface-header__content">
        {eyebrow != null ? (
          <div className="astra-surface-header__eyebrow">{eyebrow}</div>
        ) : null}
        {title != null ? (
          <Heading id={titleId} className="astra-surface-header__title">
            {title}
          </Heading>
        ) : null}
        {identifier != null ? (
          <code className={classes('astra-surface-header__identifier', identifierClassName)}>
            {identifier}
          </code>
        ) : null}
      </div>
      {actions != null ? (
        <div className={classes('astra-surface-header__actions', actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'small' | 'medium';
export type ButtonTone = 'neutral' | 'accent';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  tone?: ButtonTone | undefined;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  className,
  variant = 'secondary',
  size = 'medium',
  tone = 'neutral',
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes('astra-button', className)}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
    />
  );
});

export interface IconButtonProps extends ButtonProps {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className, ...props }, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        className={classes('astra-icon-button', className)}
        aria-label={label}
      />
    );
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: SurfaceKind | undefined;
  status?: string | undefined;
  tone?: 'neutral' | 'kind' | 'status' | 'universe' | undefined;
}

export function Badge({
  className,
  kind,
  status,
  tone = kind ? 'kind' : status ? 'status' : 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={classes('astra-badge', className)}
      data-tone={tone}
      {...(kind ? { 'data-kind': kind } : {})}
      {...(status ? { 'data-status': status } : {})}
    />
  );
}
