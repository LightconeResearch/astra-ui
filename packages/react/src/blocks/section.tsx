import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';

export type InventorySectionId = 'outputs' | 'decisions' | 'inputs' | 'findings' | 'prior_insights' | 'papers';

export interface InventorySectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Anchor id for the heading; also the outline link target. */
  id: string;
  /** Which built-in section this is, for the section-specific layout hooks. */
  section?: InventorySectionId | undefined;
  title: ReactNode;
  count?: number | undefined;
}

/** A titled, counted block of the inventory page. */
export const InventorySection = forwardRef<HTMLElement, InventorySectionProps>(function InventorySection({
  id,
  section,
  title,
  count,
  className,
  children,
  ...props
}, ref) {
  return (
    <section
      {...props}
      ref={ref}
      data-slot="inventory-section"
      className={cn('astra-inventory__section', className)}
      {...(section ? { 'data-section': section } : {})}
    >
      <div className="astra-inventory__heading">
        <h2 id={id} tabIndex={-1}>
          <span>{title}</span>
        </h2>
        {count !== undefined ? <span>{count}</span> : null}
      </div>
      {children}
    </section>
  );
});

export interface InventoryOutlineEntry {
  id: string;
  label: ReactNode;
  count?: number | undefined;
}

export interface InventoryOutlineProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  entries: InventoryOutlineEntry[];
  title?: ReactNode | undefined;
}

/** The sticky "on this page" list of section anchors. */
export const InventoryOutline = forwardRef<HTMLElement, InventoryOutlineProps>(function InventoryOutline({
  entries,
  title,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  return (
    <aside
      {...props}
      ref={ref}
      data-slot="inventory-outline"
      className={cn('astra-inventory-outline', className)}
      aria-label={labels.outline}
    >
      <h3>{title ?? labels.outline}</h3>
      <nav>
        {entries.map((entry) => (
          <a key={entry.id} href={`#${entry.id}`}>
            <span>{entry.label}</span>
            {entry.count !== undefined ? <span>{entry.count}</span> : null}
          </a>
        ))}
      </nav>
    </aside>
  );
});

export interface InventoryRecordsProps extends HTMLAttributes<HTMLDivElement> {
  kind: 'output' | 'decision' | 'input' | 'finding' | 'prior_insight' | 'paper';
}

/** Wrapper that gives a per-kind list its layout hooks. */
export const InventoryRecords = forwardRef<HTMLDivElement, InventoryRecordsProps>(function InventoryRecords({ kind, className, ...props }, ref) {
  return <div {...props} ref={ref} data-slot="inventory-records" className={cn('astra-inventory-records', className)} data-kind={kind} />;
});
