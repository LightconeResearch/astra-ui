import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type DetailLayoutMode = 'split' | 'single';

export interface DetailLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** `split` places a rail beside the main column; `single` is one scrolling column. */
  layout?: DetailLayoutMode | undefined;
}

/** Two-column (or single-column) frame for a record detail body. */
export const DetailLayout = forwardRef<HTMLDivElement, DetailLayoutProps>(function DetailLayout({
  layout = 'split',
  className,
  ...props
}, ref) {
  return (
    <div
      data-slot="detail-layout"
      {...props}
      ref={ref}
      className={cn('astra-detail__layout', className)}
      data-layout={layout}
    />
  );
});

export const DetailMain = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DetailMain({ className, ...props }, ref) {
  return <div data-slot="detail-main" {...props} ref={ref} className={cn('astra-detail__main', className)} />;
});

export interface DetailRailProps extends HTMLAttributes<HTMLElement> {
  label: string;
}

export const DetailRail = forwardRef<HTMLElement, DetailRailProps>(function DetailRail({ label, className, ...props }, ref) {
  return <aside data-slot="detail-rail" {...props} ref={ref} className={cn('astra-detail__aside', className)} aria-label={label} />;
});

export interface DetailSectionProps extends HTMLAttributes<HTMLElement> {
  label: ReactNode;
  /** `section` renders the label as a section heading rather than an eyebrow. */
  heading?: 'eyebrow' | 'section' | undefined;
}

/** A labelled block of prose or content inside a detail body. */
export const DetailSection = forwardRef<HTMLElement, DetailSectionProps>(function DetailSection({
  label,
  heading = 'eyebrow',
  className,
  children,
  ...props
}, ref) {
  return (
    <section
      data-slot="detail-section"
      {...props}
      ref={ref}
      className={cn('astra-detail__section', className)}
      {...(heading === 'section' ? { 'data-heading': 'section' } : {})}
    >
      <span>{label}</span>
      <div>{children}</div>
    </section>
  );
});

export interface CountHeadingProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'title'> {
  title: ReactNode;
  count: number;
}

export const CountHeading = forwardRef<HTMLHeadingElement, CountHeadingProps>(function CountHeading({
  title,
  count,
  className,
  ...props
}, ref) {
  return (
    <h4 data-slot="count-heading" {...props} ref={ref} className={cn('astra-count-heading', className)}>
      {title} <span>{count}</span>
    </h4>
  );
});
