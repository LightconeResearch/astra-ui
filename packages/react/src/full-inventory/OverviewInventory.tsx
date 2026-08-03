import { useMemo } from 'react';
import { createInventoryModel } from './model.js';
import type { InventoryModel } from './model.js';
import type { InventoryScope, InventorySnapshot } from './types.js';

export interface OverviewInventoryProps {
  snapshot: InventorySnapshot;
  scopeId: string;
  onSelectScope: (scopeId: string) => void;
}

function ProjectDocumentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
      className="inline mr-2 shrink-0"
      width="1.25rem"
      height="1.25rem"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function ScopeNode({
  scope,
  model,
  currentScopeId,
  depth,
  ancestors,
  onSelectScope,
}: {
  scope: InventoryScope;
  model: InventoryModel;
  currentScopeId: string;
  depth: number;
  ancestors: ReadonlySet<string>;
  onSelectScope: (scopeId: string) => void;
}) {
  const active = scope.id === currentScopeId;
  const nextAncestors = new Set(ancestors).add(scope.id);
  const children = scope.children
    .map((id) => model.scopeById.get(id))
    .filter(
      (child): child is InventoryScope => Boolean(child && !nextAncestors.has(child.id)),
    );

  return (
    <>
      <li>
        <button
          type="button"
          className={[
            'no-underline flex self-center w-full text-left hover:text-blue-700',
            active ? 'text-blue-600' : '',
          ].join(' ')}
          style={{ paddingInlineStart: `${Math.min(depth, 3) * 1.25}rem` }}
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelectScope(scope.id)}
        >
          <ProjectDocumentIcon />
          <span>{scope.name}</span>
        </button>
      </li>
      {children.map((child) => (
        <ScopeNode
          key={child.id || 'root'}
          scope={child}
          model={model}
          currentScopeId={currentScopeId}
          depth={depth + 1}
          ancestors={nextAncestors}
          onSelectScope={onSelectScope}
        />
      ))}
    </>
  );
}

export function OverviewInventory({
  snapshot,
  scopeId,
  onSelectScope,
}: OverviewInventoryProps) {
  const model = useMemo(() => createInventoryModel(snapshot), [snapshot]);
  const roots = snapshot.scopes.filter(
    (scope) => scope.parent === undefined || !model.scopeById.has(scope.parent),
  );

  return (
    <div
      className="inventory-project-structure exclude-from-outline"
      aria-labelledby="inventory-project-structure-title"
    >
      <div
        id="inventory-project-structure-title"
        role="heading"
        aria-level={2}
        className="myst-supporting-documents my-4 text-sm leading-6 uppercase text-slate-900 dark:text-slate-100"
      >
        Project hierarchy
      </div>
      <ul className="flex flex-col gap-2 pl-0 text-sm leading-6 list-none text-slate-700 dark:text-slate-300">
        {roots.map((scope) => (
          <ScopeNode
            key={scope.id || 'root'}
            scope={scope}
            model={model}
            currentScopeId={scopeId}
            depth={0}
            ancestors={new Set()}
            onSelectScope={onSelectScope}
          />
        ))}
      </ul>
    </div>
  );
}
