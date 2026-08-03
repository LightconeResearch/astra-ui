import type { ReactNode } from 'react';
import { InventoryCountHeading } from './InventoryPrimitives.js';

export interface InventoryRelationItem {
  key: string;
  label: ReactNode;
  identifier?: ReactNode | undefined;
  detail?: ReactNode | undefined;
  accessibleLabel?: string | undefined;
  onOpen?: (() => void) | undefined;
}

export function InventoryRelationList({
  title,
  items,
  empty,
  className = 'inventory-record-detail__relations',
  headerAction,
}: {
  title: ReactNode;
  items: InventoryRelationItem[];
  empty: ReactNode;
  className?: string | undefined;
  headerAction?: ReactNode | undefined;
}) {
  return (
    <section className={`inventory-relation-list ${className}`}>
      {headerAction ? (
        <div className="inventory-relation-list__header">
          <InventoryCountHeading title={title} count={items.length} />
          {headerAction}
        </div>
      ) : (
        <InventoryCountHeading title={title} count={items.length} />
      )}
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.key} className={item.onOpen ? 'has-inventory-relation-trigger' : undefined}>
              {item.onOpen ? (
                <button
                  type="button"
                  className="inventory-relation-trigger"
                  aria-label={item.accessibleLabel}
                  onClick={item.onOpen}
                >
                  <span>
                    <strong>{item.label}</strong>
                    {item.identifier != null ? <code>{item.identifier}</code> : null}
                  </span>
                  {item.detail != null ? <small>{item.detail}</small> : null}
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <>
                  <span>
                    <strong>{item.label}</strong>
                    {item.identifier != null ? <code>{item.identifier}</code> : null}
                  </span>
                  {item.detail != null ? <small>{item.detail}</small> : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : <p>{empty}</p>}
    </section>
  );
}
