import {
  indexAnalysis,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedOutput,
  type ResolvedRecord,
} from '@astra-spec/sdk';
import { forwardRef, useEffect, useMemo, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { collectInventoryPapers, findPaper, type InventoryPaper, type InventoryPaperMetadataMap } from '../model/papers.js';
import { locateRecord } from '../model/locate-record.js';
import { cn } from '../lib/cn.js';
import { LabelsProvider, useLabels, type AstraLabelOverrides } from '../lib/labels.js';
import type { DetailEntry } from '../components/detail-entry.js';
import type { PaperRenderer } from '../components/paper-detail.js';
import { RecordDialog } from '../components/record-dialog.js';
import { useDetailStack } from '../components/use-detail-stack.js';
import type { ArtifactRenderer } from '../components/artifact-preview.js';
import { DialogProvider, type DialogMode } from '../primitives/dialog.js';
import type { TextRenderer } from '../primitives/prose.js';
import { DecisionsList } from '../blocks/decisions-list.js';
import { FindingsList } from '../blocks/findings-list.js';
import { InputsList } from '../blocks/inputs-list.js';
import { OutputsList } from '../blocks/outputs-list.js';
import { PapersList } from '../blocks/papers-list.js';
import { PriorInsightsList } from '../blocks/prior-insights-list.js';
import { InventoryOutline, InventorySection, sectionKind, type InventorySectionId } from '../blocks/section.js';

export const DEFAULT_SECTIONS: readonly InventorySectionId[] = ['outputs', 'decisions', 'inputs', 'findings', 'prior_insights', 'papers'];

export interface InventoryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  document: ResolvedAnalysisDocument;
  /** Pass a prebuilt index to share it with the host; otherwise one is derived from `document`. */
  index?: AnalysisIndex | undefined;
  /** Canonical analysis path; `$` selects the project root. A path the document does not contain shows the root. */
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
export const Inventory = forwardRef<HTMLDivElement, InventoryProps>(function Inventory({ labels, ...props }, ref) {
  return (
    <LabelsProvider labels={labels}>
      <ExplorerBody {...props} ref={ref} />
    </LabelsProvider>
  );
});

const ExplorerBody = forwardRef<HTMLDivElement, Omit<InventoryProps, 'labels'>>(function ExplorerBody({
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
  const index = useMemo(() => providedIndex ?? indexAnalysis(document), [document, providedIndex]);
  const analysis = index.analysisByPath.get(analysisPath) ?? document.analysis;
  const papers = useMemo(
    () => collectInventoryPapers(document, index, analysis, paperMetadata),
    [analysis, document, index, paperMetadata],
  );
  const stack = useDetailStack({ value: detail, defaultValue: defaultDetail, onChange: onDetailChange });

  // Switching analysis closes any open detail (uncontrolled stacks only), and
  // entries that stopped resolving after a document refresh are pruned so the
  // host's view of the stack stays truthful. One effect, so a single commit
  // makes at most one change: closing must not be followed by a prune of the
  // stack it just replaced. It runs after render, never inside it, because it
  // notifies the host.
  const lastAnalysis = useRef(analysis.canonicalPath);
  useEffect(() => {
    const analysisChanged = lastAnalysis.current !== analysis.canonicalPath;
    lastAnalysis.current = analysis.canonicalPath;
    if (analysisChanged && detail === undefined) {
      if (stack.stack.length) stack.close();
      return;
    }
    const resolves = (entry: DetailEntry) => (entry.kind === 'paper'
      ? Boolean(findPaper(papers, entry.doi))
      : Boolean(locateRecord(index, entry.canonicalPath))) && index.analysisByPath.has(entry.analysisPath);
    const next = stack.stack.filter(resolves);
    if (next.length !== stack.stack.length) stack.set(next);
  }, [analysis.canonicalPath, detail, index, papers, stack]);

  const openRecord = (record: ResolvedRecord, owner: ResolvedAnalysisNode) => { stack.openRecord(record, owner); };

  const sectionContent: Record<InventorySectionId, { count: number; content: ReactNode }> = {
    outputs: {
      count: analysis.outputs.length,
      content: <OutputsList analysis={analysis} renderArtifact={renderArtifact} onOpenRecord={openRecord} />,
    },
    decisions: {
      count: analysis.decisions.length,
      content: <DecisionsList analysis={analysis} tagLabels={decisionTagLabels} onOpenRecord={openRecord} />,
    },
    inputs: {
      count: analysis.inputs.length,
      content: <InputsList analysis={analysis} onOpenRecord={openRecord} />,
    },
    findings: {
      count: analysis.findings.length,
      content: <FindingsList analysis={analysis} onOpenRecord={openRecord} />,
    },
    prior_insights: {
      count: analysis.prior_insights.length,
      content: <PriorInsightsList analysis={analysis} onOpenRecord={openRecord} />,
    },
    papers: {
      count: papers.length,
      content: (
        <PapersList
          papers={papers}
          analysis={analysis}
          onOpenPaper={(paper, owner) => { stack.openPaper(paper.doi, owner); }}
        />
      ),
    },
  };
  const anchorId = (section: InventorySectionId) => `${idPrefix}${section.replace('_', '-')}`;

  return (
    <div data-slot="inventory" {...rest} ref={ref} className={cn('astra-inventory', className)}>
      <div className="astra-inventory__layout">
        <div className="astra-inventory__sections">
          {sections.map((section) => (
            <InventorySection
              key={section}
              id={anchorId(section)}
              section={section}
              title={labels.sections[section]}
              count={sectionContent[section].count}
              countLabel={labels.sectionCount(section, sectionContent[section].count)}
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
              kind: sectionKind(section),
            }))}
          />
        ) : null}
      </div>
      {stack.active ? (
        <DialogProvider mode={detailMode} backText={stack.previous ? entryLabel(stack.previous, papers) : undefined}>
          <RecordDialog
            entry={stack.active}
            fallback={<p>{labels.notFound}</p>}
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
