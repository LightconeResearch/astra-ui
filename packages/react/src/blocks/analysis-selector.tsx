import { forwardRef, useEffect, useId, useRef, useState, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { AnalysisTree, type AnalysisTreeProps } from './analysis-tree.js';

export interface AnalysisSelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>,
  Pick<AnalysisTreeProps, 'document' | 'analysisPath' | 'onSelectAnalysis'> {}

/** A compact analysis picker for host headers; selection remains owned by the host. */
export const AnalysisSelector = forwardRef<HTMLDivElement, AnalysisSelectorProps>(function AnalysisSelector({
  document,
  analysisPath = '$',
  onSelectAnalysis,
  className,
  onBlur,
  ...props
}, ref) {
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const popover = popoverRef.current;
    const ownerDocument = popover?.ownerDocument;
    const selected = popover?.querySelector<HTMLButtonElement>('button[aria-current="page"]')
      ?? popover?.querySelector<HTMLButtonElement>('button');
    selected?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!popover?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    // Handle Escape only within this picker, before it can dismiss a host dialog.
    const root = triggerRef.current?.parentElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    root?.addEventListener('keydown', onKeyDown);
    ownerDocument?.addEventListener('pointerdown', onPointerDown);
    return () => {
      root?.removeEventListener('keydown', onKeyDown);
      ownerDocument?.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div
      data-slot="analysis-selector"
      role="group"
      aria-label={labels.currentAnalysis}
      {...props}
      ref={ref}
      className={cn('astra-analysis-selector', className)}
      onBlur={(event) => {
        onBlur?.(event);
        if (!event.defaultPrevented && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="astra-analysis-selector__trigger"
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => { setOpen(value => !value); }}
      >
        <span>{labels.currentAnalysis}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open ? (
        <div
          className="astra-analysis-selector__popover"
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={labels.selectAnalysis}
        >
          <AnalysisTree
            document={document}
            analysisPath={analysisPath}
            showHeading={false}
            onSelectAnalysis={(path) => {
              setOpen(false);
              triggerRef.current?.focus();
              onSelectAnalysis(path);
            }}
          />
        </div>
      ) : null}
    </div>
  );
});
