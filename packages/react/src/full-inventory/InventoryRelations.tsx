import type { ReactNode } from 'react';
import { InventoryCountHeading } from './InventoryPrimitives.js';
import type { InventoryKind } from './types.js';

const RELATION_GLYPHS: Record<InventoryKind | 'paper', string> = {
  analysis: '◐',
  input: '↳',
  decision: '◇',
  output: '◆',
  finding: '●',
  prior_insight: '◈',
  paper: '▧',
};

export interface InventoryRelationItem {
  key: string;
  label: ReactNode;
  identifier?: ReactNode | undefined;
  detail?: ReactNode | undefined;
  kind?: InventoryKind | 'paper' | undefined;
  className?: string | undefined;
  accessibleLabel?: string | undefined;
  onOpen?: (() => void) | undefined;
}

export function InventoryRelationList({
  title,
  items,
  empty,
  className = 'inventory-record-detail__relations',
  headerAction,
  description,
}: {
  title: ReactNode;
  items: InventoryRelationItem[];
  empty: ReactNode;
  className?: string | undefined;
  headerAction?: ReactNode | undefined;
  description?: ReactNode | undefined;
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
      {description ? (
        <p className="inventory-relation-list__description">{description}</p>
      ) : null}
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li
              key={item.key}
              data-kind={item.kind}
              className={[
                item.onOpen ? 'has-inventory-relation-trigger' : '',
                item.className ?? '',
              ].filter(Boolean).join(' ') || undefined}
            >
              {item.onOpen ? (
                <button
                  type="button"
                  className="inventory-relation-trigger"
                  aria-label={item.accessibleLabel}
                  onClick={item.onOpen}
                >
                  <span
                    className={`inventory-relation-item__glyph${item.kind ? '' : ' is-empty'}`}
                    aria-hidden="true"
                  >
                    {item.kind ? RELATION_GLYPHS[item.kind] : ''}
                  </span>
                  <span className="inventory-relation-item__copy">
                    <strong>{item.label}</strong>
                    {item.identifier != null ? <code>{item.identifier}</code> : null}
                  </span>
                  {item.detail != null ? <small>{item.detail}</small> : null}
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <>
                  <span
                    className={`inventory-relation-item__glyph${item.kind ? '' : ' is-empty'}`}
                    aria-hidden="true"
                  >
                    {item.kind ? RELATION_GLYPHS[item.kind] : ''}
                  </span>
                  <span className="inventory-relation-item__copy">
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
