import {
  indexResolvedAnalysis,
  type ResolvedAnalysis,
  type Analysis,
  type ResolvedAnalysisIndex,
} from '@astra-spec/sdk/reports';
import { forwardRef, useId, useMemo, type HTMLAttributes } from 'react';
import { analysisTitle } from '../model/records.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';

export interface AnalysisTreeProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  document: ResolvedAnalysis;
  /** The selected analysis key; the root is the empty string. */
  analysisKey?: string | undefined;
  onSelectAnalysis: (key: string) => void;
  showHeading?: boolean | undefined;
}

function AnalysisNode({
  analysis,
  index,
  selectedPath,
  onSelectAnalysis,
  ancestors,
}: {
  analysis: Analysis;
  index: ResolvedAnalysisIndex;
  selectedPath: string;
  onSelectAnalysis: (key: string) => void;
  ancestors: ReadonlySet<string>;
}) {
  const repeated = ancestors.has(analysis.key),
    next = new Set([...ancestors, analysis.key]);
  const children = repeated
    ? []
    : [...new Set(Object.values(analysis.declares))].flatMap((key) => {
        const child = index.analysisByKey.get(key);
        return child ? [child] : [];
      });
  return (
    <li>
      <button
        type="button"
        className="astra-analysis-tree__select"
        aria-current={analysis.key === selectedPath ? 'page' : undefined}
        onClick={() => {
          onSelectAnalysis(analysis.key);
        }}
      >
        <span>{analysisTitle(analysis)}</span>
      </button>
      {children.length ? (
        <ul>
          {children.map((child) => (
            <AnalysisNode
              key={child.key}
              analysis={child}
              index={index}
              selectedPath={selectedPath}
              onSelectAnalysis={onSelectAnalysis}
              ancestors={next}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
/** Declaration navigation follows the report graph and stops at back-references. */
export const AnalysisTree = forwardRef<HTMLElement, AnalysisTreeProps>(function AnalysisTree(
  { document, analysisKey = '', onSelectAnalysis, showHeading = true, className, 'aria-label': hostLabel, ...props },
  ref,
) {
  const labels = useLabels(),
    headingId = useId(),
    index = useMemo(() => indexResolvedAnalysis(document), [document]),
    root = index.analysisByKey.get('');
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
        {root ? (
          <AnalysisNode
            analysis={root}
            index={index}
            selectedPath={analysisKey}
            onSelectAnalysis={onSelectAnalysis}
            ancestors={new Set()}
          />
        ) : null}
      </ul>
    </nav>
  );
});
