import type { ResolvedAnalysisDocument } from '@astra-spec/sdk';
import React, { useEffect, useRef, useState } from 'react';
import { AnalysisTree } from './analysis-tree.js';

export function AnalysisSelector({
  analysisPath,
  document: analysisDocument,
  onSelectAnalysis
}: {
  analysisPath: string;
  document: ResolvedAnalysisDocument;
  onSelectAnalysis: (analysisPath: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="astra-analysis-selector" ref={containerRef}>
      <button
        type="button"
        className="astra-analysis-selector__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { setOpen(value => !value); }}
      >
        <span className="astra-analysis-selector__label">Current analysis</span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div
          className="astra-analysis-selector__popover"
          role="dialog"
          aria-label="Select an analysis"
        >
          <AnalysisTree
            document={analysisDocument}
            analysisPath={analysisPath}
            showHeading={false}
            onSelectAnalysis={nextPath => {
              onSelectAnalysis(nextPath);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
