import type { ResolvedAnalysisDocument, ResolvedAnalysisNode } from '@astra-spec/sdk';
import { forwardRef, useId, useState, type HTMLAttributes } from 'react';
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

function AnalysisIcon({ folder }: { folder: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
      width="1.25rem"
      height="1.25rem"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={folder
          ? 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 2h18'
          : 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5'}
      />
    </svg>
  );
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
  const active = analysis.canonicalPath === selectedPath;
  const hasChildren = analysis.analyses.length > 0;
  const childrenId = useId();
  const [expanded, setExpanded] = useState(true);
  const [lastSelected, setLastSelected] = useState(selectedPath);
  // Reveal a selection opened by a host command, even inside a collapsed branch.
  if (lastSelected !== selectedPath) {
    setLastSelected(selectedPath);
    if (analysis.canonicalPath === '$' || selectedPath.startsWith(`${analysis.canonicalPath}.`)) {
      setExpanded(true);
    }
  }
  const title = analysisTitle(analysis);
  return (
    <li>
      <div className="astra-analysis-tree__row">
        {hasChildren ? (
          <button
            className="astra-analysis-tree__toggle"
            type="button"
            aria-label={`${title} sub-analyses`}
            aria-expanded={expanded}
            aria-controls={childrenId}
            onClick={() => { setExpanded(!expanded); }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d={expanded ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} />
            </svg>
          </button>
        ) : <span className="astra-analysis-tree__spacer" aria-hidden="true" />}
        <button
          type="button"
          className="astra-analysis-tree__select"
          title={title}
          aria-current={active ? 'page' : undefined}
          onClick={() => { onSelectAnalysis(analysis.canonicalPath); }}
        >
          <AnalysisIcon folder={hasChildren} />
          <span>{title}</span>
        </button>
      </div>
      {hasChildren ? (
        <ul id={childrenId} hidden={!expanded}>
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
