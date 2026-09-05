import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { surfaceGlyph, type SurfaceKind } from '../primitives/kind.js';
import { useLabels } from '../lib/labels.js';

export type InventorySectionId = 'outputs' | 'decisions' | 'inputs' | 'findings' | 'papers';

export interface InventorySectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Anchor id for the heading; also the outline link target. */
  id: string;
  /** Which built-in section this is, for the section-specific layout hooks. */
  section?: InventorySectionId | undefined;
  title: ReactNode;
  count?: number | undefined;
  /** Text shown for the count, e.g. "65 outputs"; defaults to the bare number. */
  countLabel?: ReactNode | undefined;
}

/** A titled, counted block of the inventory page. */
export const InventorySection = forwardRef<HTMLElement, InventorySectionProps>(function InventorySection({
  id,
  section,
  title,
  count,
  countLabel,
  className,
  children,
  ...props
}, ref) {
  return (
    <section
      data-slot="inventory-section"
      {...props}
      ref={ref}
      className={cn('astra-inventory__section', className)}
      {...(section ? { 'data-section': section } : {})}
    >
      <div className="astra-inventory__heading">
        <h2 id={id} tabIndex={-1}>
          <span>{title}</span>
        </h2>
        {count !== undefined ? <span>{countLabel ?? count}</span> : null}
      </div>
      {children}
    </section>
  );
});

/** The record kind each inventory section lists; drives the outline glyph and colour. */
export function sectionKind(section: InventorySectionId): SurfaceKind {
  switch (section) {
    case 'outputs': return 'output';
    case 'decisions': return 'decision';
    case 'inputs': return 'input';
    case 'findings': return 'finding';
    case 'papers': return 'paper';
  }
}

export interface InventoryOutlineEntry {
  id: string;
  label: ReactNode;
  count?: number | undefined;
  /** Shows the kind's glyph in the kind's colour before the label. */
  kind?: SurfaceKind | undefined;
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
      data-slot="inventory-outline"
      {...props}
      ref={ref}
      className={cn('astra-inventory-outline', className)}
      aria-label={labels.outline}
    >
      <h3>{title ?? labels.outline}</h3>
      <nav>
        {entries.map((entry) => (
          <a key={entry.id} href={`#${entry.id}`}>
            <span className="astra-inventory-outline__glyph" {...(entry.kind ? { 'data-kind': entry.kind } : {})} aria-hidden="true">
              {entry.kind ? surfaceGlyph(entry.kind) : null}
            </span>
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
  return <div data-slot="inventory-records" {...props} ref={ref} className={cn('astra-inventory-records', className)} data-kind={kind} />;
});
