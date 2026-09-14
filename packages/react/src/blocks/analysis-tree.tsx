import type { ResolvedAnalysisDocument, ResolvedAnalysisNode } from '@astra-spec/sdk';
import { forwardRef, useId, type HTMLAttributes } from 'react';
import { analysisTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';

export interface AnalysisTreeProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  document: ResolvedAnalysisDocument;
  /** Canonical path of the selected analysis; `$` is the project root. */
  analysisPath?: string | undefined;
  onSelectAnalysis: (canonicalPath: string) => void;
  /** Hide the heading (e.g. inside a popover). */
  showHeading?: boolean | undefined;
}

function AnalysisNode({
  analysis,
  selectedPath,
  onSelectAnalysis,
}: {
  analysis: ResolvedAnalysisNode;
  selectedPath: string;
  onSelectAnalysis: (canonicalPath: string) => void;
}) {
  const title = analysisTitle(analysis);
  return (
    <li>
      <button
        type="button"
        className="astra-analysis-tree__select"
        title={title}
        aria-current={analysis.canonicalPath === selectedPath ? 'page' : undefined}
        onClick={() => { onSelectAnalysis(analysis.canonicalPath); }}
      >
        <span>{title}</span>
      </button>
      {analysis.analyses.length ? (
        <ul>
          {analysis.analyses.map((child) => (
            <AnalysisNode
              key={child.canonicalPath}
              analysis={child}
              selectedPath={selectedPath}
              onSelectAnalysis={onSelectAnalysis}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The recursive analysis picker: the project root and its sub-analyses. */
export const AnalysisTree = forwardRef<HTMLElement, AnalysisTreeProps>(function AnalysisTree({
  document,
  analysisPath = '$',
  onSelectAnalysis,
  showHeading = true,
  className,
  'aria-label': hostLabel,
  ...props
}, ref) {
  const labels = useLabels();
  const headingId = useId();
  return (
    <nav
      data-slot="analysis-tree"
      {...props}
      ref={ref}
      className={cn('astra-analysis-tree', className)}
      aria-labelledby={showHeading && !hostLabel ? headingId : undefined}
      aria-label={hostLabel ?? (showHeading ? undefined : labels.analysisTree)}
    >
      {showHeading ? <h2 id={headingId}>{labels.analysisTree}</h2> : null}
      <ul>
        <AnalysisNode
          analysis={document.analysis}
          selectedPath={analysisPath}
          onSelectAnalysis={onSelectAnalysis}
        />
      </ul>
    </nav>
  );
});
