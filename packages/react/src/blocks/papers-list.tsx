import type { ResolvedAnalysisNode } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import type { InventoryPaper } from '../model/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { PaperRow } from '../components/paper-row.js';
import { EmptyState } from '../primitives/record-list.js';
import { InventoryRecords } from './section.js';

export interface PapersListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  papers: readonly InventoryPaper[];
  analysis: ResolvedAnalysisNode;
  onOpenPaper: (paper: InventoryPaper, analysis: ResolvedAnalysisNode) => void;
}

export interface PaperRowsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  papers: readonly InventoryPaper[];
  onOpen: (paper: InventoryPaper) => void;
}

/** Cited papers with their insight and decision counts. */
export const PaperRows = forwardRef<HTMLDivElement, PaperRowsProps>(function PaperRows({ papers, onOpen, className, ...props }, ref) {
  const labels = useLabels();
  return (
    <div data-slot="paper-list" {...props} ref={ref} className={cn('astra-paper-list', className)} role="group" aria-label={labels.sections.papers}>
      {papers.map((paper) => (
        <PaperRow key={paper.doi} paper={paper} onOpen={() => { onOpen(paper); }} />
      ))}
    </div>
  );
});

export const PapersList = forwardRef<HTMLDivElement, PapersListProps>(function PapersList({
  papers,
  analysis,
  onOpenPaper,
  className,
  ...props
}, ref) {
  const labels = useLabels();
  if (!papers.length) {
    return <EmptyState data-slot="papers-list" {...props} ref={ref} className={className}>{labels.empty.papers}</EmptyState>;
  }
  return (
    <InventoryRecords {...props} ref={ref} kind="paper" className={className}>
      <PaperRows papers={papers} onOpen={(paper) => { onOpenPaper(paper, analysis); }} />
    </InventoryRecords>
  );
});
