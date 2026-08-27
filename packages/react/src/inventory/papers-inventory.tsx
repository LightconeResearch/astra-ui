import type { ResolvedAnalysisNode } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import type { InventoryPaper } from '../data/papers.js';
import { countLabel } from '../data/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { EmptyState } from '../ui/record-list.js';
import { InventoryRecords } from './section.js';

export interface PapersInventoryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  papers: readonly InventoryPaper[];
  analysis: ResolvedAnalysisNode;
  onOpenPaper: (paper: InventoryPaper, analysis: ResolvedAnalysisNode) => void;
}

export interface PaperListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  papers: readonly InventoryPaper[];
  onOpen: (paper: InventoryPaper) => void;
}

/** Cited papers with their insight and decision counts. */
export const PaperList = forwardRef<HTMLDivElement, PaperListProps>(function PaperList({ papers, onOpen, className, ...props }, ref) {
  const labels = useLabels();
  return (
    <div {...props} ref={ref} data-slot="paper-list" className={cn('astra-paper-list', className)} role="group" aria-label={labels.sections.papers}>
      {papers.map((paper) => (
        <button
          key={paper.doi}
          type="button"
          aria-label={`${paper.title}, ${paper.doi}, ${countLabel(paper.insights.length, 'insight')}, ${countLabel(paper.decisions.length, 'decision')}`}
          onClick={() => { onOpen(paper); }}
        >
          <span className="astra-paper-list__thumbnail" aria-hidden="true">p.1</span>
          <span className="astra-paper-list__copy">
            <strong>{paper.title}</strong>
            <small>{[paper.authors, paper.doi].filter(Boolean).join(' · ')}</small>
          </span>
          <span className="astra-paper-list__meta">
            {countLabel(paper.insights.length, 'insight')} ·{' '}
            {countLabel(paper.decisions.length, 'decision')}
          </span>
          <span className="astra-paper-list__arrow" aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
});

export const PapersInventory = forwardRef<HTMLDivElement, PapersInventoryProps>(function PapersInventory({
  papers,
  analysis,
  onOpenPaper,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  if (!papers.length) {
    return <EmptyState {...props} ref={ref} data-slot="papers-inventory" className={className}>{labels.empty.papers}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="paper" className={className}>
      <PaperList papers={papers} onOpen={(paper) => { onOpenPaper(paper, analysis); }} />
    </InventoryRecords>
  );
});
