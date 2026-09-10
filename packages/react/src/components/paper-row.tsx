import { forwardRef, type HTMLAttributes } from 'react';
import type { InventoryPaper } from '../model/papers.js';
import { countLabel } from '../model/records.js';
import { cn } from '../lib/cn.js';

export interface PaperRowProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  paper: InventoryPaper;
  onOpen: () => void;
}

/** One cited paper: title, byline, and how much of the analysis leans on it. */
export const PaperRow = forwardRef<HTMLButtonElement, PaperRowProps>(function PaperRow({
  paper,
  onOpen,
  className,
  onClick,
  'aria-label': hostLabel,
  ...props
}, ref) {
  const insights = countLabel(paper.insights.length, 'insight');
  const decisions = countLabel(paper.decisions.length, 'decision');
  return (
    <button
      data-slot="paper-row"
      {...props}
      ref={ref}
      type="button"
      className={cn('astra-paper-row', className)}
      aria-label={hostLabel ?? `${paper.title}, ${paper.doi}, ${insights}, ${decisions}`}
      onClick={(event) => { onClick?.(event); onOpen(); }}
    >
      <span className="astra-paper-row__thumbnail" aria-hidden="true">p.1</span>
      <span className="astra-paper-row__copy">
        <strong>{paper.title}</strong>
        <small>{[paper.authors, paper.doi].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="astra-paper-row__meta">{insights} · {decisions}</span>
      <span className="astra-paper-row__arrow" aria-hidden="true">→</span>
    </button>
  );
});
