import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { CountHeading } from './detail-layout.js';
import { surfaceGlyph, type SurfaceKind } from './kind.js';

export interface RelationItem {
  key: string;
  label: ReactNode;
  identifier?: ReactNode | undefined;
  detail?: ReactNode | undefined;
  kind?: SurfaceKind | undefined;
  className?: string | undefined;
  accessibleLabel?: string | undefined;
  onOpen?: (() => void) | undefined;
}

export interface RelationListProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  items: RelationItem[];
  empty: ReactNode;
  headerAction?: ReactNode | undefined;
  description?: ReactNode | undefined;
}

function RelationItemContent({ item }: { item: RelationItem }) {
  return (
    <>
      <span
        className="astra-relation-item__glyph"
        {...(item.kind ? {} : { 'data-empty': '' })}
        aria-hidden="true"
      >
        {item.kind ? surfaceGlyph(item.kind) : ''}
      </span>
      <span className="astra-relation-item__copy">
        <span className="astra-relation-item__label">{item.label}</span>
        {item.identifier != null ? <code>{item.identifier}</code> : null}
      </span>
      {item.detail != null ? <small>{item.detail}</small> : null}
    </>
  );
}

/** A titled, counted list of related records; items with `onOpen` become navigation triggers. */
export const RelationList = forwardRef<HTMLElement, RelationListProps>(function RelationList({
  title,
  items,
  empty,
  headerAction,
  description,
  className,
  ...props
}, ref) {
  return (
    <section {...props} ref={ref} data-slot="relation-list" className={cn('astra-relation-list', className)}>
      {headerAction ? (
        <div className="astra-relation-list__header">
          <CountHeading title={title} count={items.length} />
          {headerAction}
        </div>
      ) : (
        <CountHeading title={title} count={items.length} />
      )}
      {description ? (
        <p className="astra-relation-list__description">{description}</p>
      ) : null}
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li
              key={item.key}
              data-kind={item.kind}
              {...(item.onOpen ? { 'data-interactive': '' } : {})}
              className={item.className}
            >
              {item.onOpen ? (
                <button
                  type="button"
                  className="astra-relation-list__trigger"
                  aria-label={item.accessibleLabel}
                  onClick={item.onOpen}
                >
                  <RelationItemContent item={item} />
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <RelationItemContent item={item} />
              )}
            </li>
          ))}
        </ul>
      ) : empty != null ? <p>{empty}</p> : null}
    </section>
  );
});
