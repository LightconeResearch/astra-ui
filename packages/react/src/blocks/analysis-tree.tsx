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

function ProjectDocumentIcon() {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function AnalysisNode({
  analysis,
  selectedPath,
  depth,
  onSelectAnalysis,
}: {
  analysis: ResolvedAnalysisNode;
  selectedPath: string;
  depth: number;
  onSelectAnalysis: (canonicalPath: string) => void;
}) {
  const active = analysis.canonicalPath === selectedPath;
  return (
    <li>
      <button
        type="button"
        style={{ paddingInlineStart: `${Math.min(depth, 4) * 1.25}rem` }}
        aria-current={active ? 'page' : undefined}
        onClick={() => { onSelectAnalysis(analysis.canonicalPath); }}
      >
        <ProjectDocumentIcon />
        <span>{analysisTitle(analysis)}</span>
      </button>
      {analysis.analyses.length ? (
        <ul>
          {analysis.analyses.map((child) => (
            <AnalysisNode
              key={child.canonicalPath}
              analysis={child}
              selectedPath={selectedPath}
              depth={depth + 1}
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
          depth={0}
          onSelectAnalysis={onSelectAnalysis}
        />
      </ul>
    </nav>
  );
});
