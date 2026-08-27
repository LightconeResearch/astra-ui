import type { ResolvedAnalysisDocument, ResolvedAnalysisNode, ResolvedOutput, ResolvedRecord } from '@astra-spec/sdk';
import { forwardRef, useEffect, useMemo, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { createInventoryIndex, type InventoryIndex } from '../data/inventory-index.js';
import { collectInventoryPapers, findPaper, type InventoryPaper, type InventoryPaperMetadataMap } from '../data/papers.js';
import { locateRecord } from '../data/inventory-index.js';
import { cn } from '../lib/cn.js';
import { LabelsProvider, useLabels, type AstraLabelOverrides } from '../lib/labels.js';
import type { DetailEntry } from '../records/detail-entry.js';
import type { PaperRenderer } from '../records/paper-detail.js';
import { RecordDialog } from '../records/record-dialog.js';
import { useDetailStack } from '../records/use-detail-stack.js';
import type { ArtifactRenderer } from '../ui/artifact-preview.js';
import { DialogProvider, type DialogMode } from '../ui/dialog.js';
import type { TextRenderer } from '../ui/prose.js';
import { DecisionsInventory } from './decisions-inventory.js';
import { FindingsInventory } from './findings-inventory.js';
import { InputsInventory } from './inputs-inventory.js';
import { OutputsInventory } from './outputs-inventory.js';
import { PapersInventory } from './papers-inventory.js';
import { PriorInsightsInventory } from './prior-insights-inventory.js';
import { InventoryOutline, InventorySection, type InventorySectionId } from './section.js';

export const DEFAULT_SECTIONS: readonly InventorySectionId[] = ['outputs', 'decisions', 'inputs', 'findings', 'prior_insights', 'papers'];

export interface InventoryExplorerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  document: ResolvedAnalysisDocument;
  /** Pass a prebuilt index to share it with the host; otherwise one is derived from `document`. */
  index?: InventoryIndex | undefined;
  /** Canonical analysis path; `$` selects the project root. */
  analysisPath?: string | undefined;
  /** Which sections to show, in order. */
  sections?: readonly InventorySectionId[] | undefined;
  /** Prefix for section anchor ids, so several explorers can share a page. */
  idPrefix?: string | undefined;
  showOutline?: boolean | undefined;
  labels?: AstraLabelOverrides | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  /** Notify the host to fetch this DOI; update paperMetadata when complete. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  decisionTagLabels?: Readonly<Record<string, string>> | undefined;
  detailMode?: DialogMode | undefined;
  /** The open detail stack (controlled); pair with `onDetailChange`. */
  detail?: DetailEntry[] | undefined;
  defaultDetail?: DetailEntry[] | undefined;
  onDetailChange?: ((next: DetailEntry[]) => void) | undefined;
  /** Extra content rendered after the built-in sections. */
  children?: ReactNode | undefined;
}

const EMPTY_PAPER_METADATA: InventoryPaperMetadataMap = {};

function entryLabel(entry: DetailEntry, papers: readonly InventoryPaper[]): string {
  return entry.kind === 'paper'
    ? findPaper(papers, entry.doi)?.title ?? entry.doi
    : entry.canonicalPath.split('.').at(-1) ?? entry.canonicalPath;
}

/**
 * The ready-made inventory page: per-kind sections, an outline, and a
 * detail dialog stack. Every piece is exported separately for hosts that
 * compose their own layout.
 */
export const InventoryExplorer = forwardRef<HTMLDivElement, InventoryExplorerProps>(function InventoryExplorer({ labels, ...props }, ref) {
  return (
    <LabelsProvider labels={labels}>
      <ExplorerBody {...props} ref={ref} />
    </LabelsProvider>
  );
});

const ExplorerBody = forwardRef<HTMLDivElement, Omit<InventoryExplorerProps, 'labels'>>(function ExplorerBody({
  document,
  index: providedIndex,
  analysisPath = '$',
  sections = DEFAULT_SECTIONS,
  idPrefix = '',
  showOutline = true,
  renderArtifact,
  renderText,
  renderPaper,
  onOpenArtifact,
  paperMetadata = EMPTY_PAPER_METADATA,
  onFetchPaper,
  decisionTagLabels = {},
  detailMode = 'modal',
  detail,
  defaultDetail,
  onDetailChange,
  className,
  children,
  ...rest
}, ref) {
  const labels = useLabels();
  const index = useMemo(() => providedIndex ?? createInventoryIndex(document), [document, providedIndex]);
  const analysis = index.analysisByPath.get(analysisPath) ?? document.analysis;
  const papers = useMemo(
    () => collectInventoryPapers(document, index, analysis, paperMetadata),
    [analysis, document, index, paperMetadata],
  );
  const stack = useDetailStack({ value: detail, defaultValue: defaultDetail, onChange: onDetailChange });

  // Switching analysis closes any open detail (uncontrolled stacks only), and
  // entries that stopped resolving after a document refresh are pruned so the
  // host's view of the stack stays truthful. Both run after render, never
  // inside it, because they notify the host.
  const lastAnalysis = useRef(analysis.canonicalPath);
  useEffect(() => {
    if (lastAnalysis.current === analysis.canonicalPath) return;
    lastAnalysis.current = analysis.canonicalPath;
    if (detail === undefined && stack.stack.length) stack.close();
  }, [analysis.canonicalPath, detail, stack]);
  useEffect(() => {
    const resolves = (entry: DetailEntry) => (entry.kind === 'paper'
      ? Boolean(findPaper(papers, entry.doi))
      : Boolean(locateRecord(index, entry.canonicalPath))) && index.analysisByPath.has(entry.analysisPath);
    const next = stack.stack.filter(resolves);
    if (next.length !== stack.stack.length) stack.set(next);
  }, [index, papers, stack]);

  const openRecord = (record: ResolvedRecord, owner: ResolvedAnalysisNode) => { stack.openRecord(record, owner); };
  const activeAnalysis = stack.active ? index.analysisByPath.get(stack.active.analysisPath) : undefined;

  const sectionContent: Record<InventorySectionId, { count: number; content: ReactNode }> = {
    outputs: {
      count: analysis.outputs.length,
      content: <OutputsInventory analysis={analysis} renderArtifact={renderArtifact} onOpenRecord={openRecord} />,
    },
    decisions: {
      count: analysis.decisions.length,
      content: <DecisionsInventory analysis={analysis} tagLabels={decisionTagLabels} onOpenRecord={openRecord} />,
    },
    inputs: {
      count: analysis.inputs.length,
      content: <InputsInventory analysis={analysis} onOpenRecord={openRecord} />,
    },
    findings: {
      count: analysis.findings.length,
      content: <FindingsInventory analysis={analysis} onOpenRecord={openRecord} />,
    },
    prior_insights: {
      count: analysis.prior_insights.length,
      content: <PriorInsightsInventory analysis={analysis} onOpenRecord={openRecord} />,
    },
    papers: {
      count: papers.length,
      content: (
        <PapersInventory
          papers={papers}
          analysis={analysis}
          onOpenPaper={(paper, owner) => { stack.openPaper(paper.doi, owner); }}
        />
      ),
    },
  };
  const anchorId = (section: InventorySectionId) => `${idPrefix}${section.replace('_', '-')}`;

  return (
    <div {...rest} ref={ref} data-slot="inventory-explorer" className={cn('astra-inventory', className)}>
      <div className="astra-inventory__layout">
        <div className="astra-inventory__sections">
          {sections.map((section) => (
            <InventorySection
              key={section}
              id={anchorId(section)}
              section={section}
              title={labels.sections[section]}
              count={sectionContent[section].count}
            >
              {sectionContent[section].content}
            </InventorySection>
          ))}
          {children}
        </div>
        {showOutline ? (
          <InventoryOutline
            entries={sections.map((section) => ({
              id: anchorId(section),
              label: labels.sections[section],
              count: sectionContent[section].count,
            }))}
          />
        ) : null}
      </div>
      {stack.active && activeAnalysis ? (
        <DialogProvider mode={detailMode} backText={stack.previous ? entryLabel(stack.previous, papers) : undefined}>
          <RecordDialog
            entry={stack.active}
            document={document}
            index={index}
            papers={papers}
            paperMetadata={paperMetadata}
            renderArtifact={renderArtifact}
            renderText={renderText}
            renderPaper={renderPaper}
            onOpenArtifact={onOpenArtifact}
            onFetchPaper={onFetchPaper}
            onOpenRecord={stack.pushRecord}
            onOpenPaper={stack.pushPaper}
            onBack={stack.previous ? stack.back : undefined}
            onClose={stack.close}
          />
        </DialogProvider>
      ) : null}
    </div>
  );
});
