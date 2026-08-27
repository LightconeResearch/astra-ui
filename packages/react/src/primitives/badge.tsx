import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import type { SurfaceKind } from './kind.js';

export type BadgeTone = 'neutral' | 'kind' | 'status' | 'universe';
export type BadgeStatus = 'available' | 'current' | 'materialized' | 'ready' | 'error' | 'missing' | 'stale';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: SurfaceKind | undefined;
  status?: BadgeStatus | (string & {}) | undefined;
  tone?: BadgeTone | undefined;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge({
  className,
  kind,
  status,
  tone = kind ? 'kind' : status ? 'status' : 'neutral',
  ...props
}, ref) {
  return (
    <span
      data-slot="badge"
      {...props}
      ref={ref}
      className={cn('astra-badge', className)}
      data-tone={tone}
      {...(kind ? { 'data-kind': kind } : {})}
      {...(status ? { 'data-status': status } : {})}
    />
  );
});
