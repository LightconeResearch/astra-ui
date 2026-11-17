import type { AstraRecord } from '../model/records.js';
import {
  indexResolvedAnalysis,
  type ResolvedAnalysisIndex,
  type ResolvedAnalysis,
  type Analysis,
  type Output,
  type StatusReport,
} from '@astra-spec/sdk/reports';
import { forwardRef, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { collectInventoryPapers, findPaper, paperForDoi, type InventoryPaper, type InventoryPaperMetadataMap } from '../model/papers.js';
import { locateRecord } from '../model/locate-record.js';
import { cn } from '../lib/cn.js';
import { LabelsProvider, useLabels, type AstraLabelOverrides } from '../lib/labels.js';
import type { OpenPaperFileHandler } from '../components/paper-detail.js';
import type { PdfJsLoader } from '../lib/pdf-runtime.js';
import type { OutputContext } from '../model/output-status.js';
import { RecordDialog } from '../components/record-dialog.js';
import { useDetailStack, type DetailEntry } from '../lib/detail-stack.js';
import type { ArtifactRenderer } from '../components/artifact-preview.js';
import { DialogProvider, type DialogMode } from '../primitives/dialog.js';
import type { TextRenderer } from '../lib/prose.js';
import { DecisionsList } from '../blocks/decisions-list.js';
import { AnalysisTree } from '../blocks/analysis-tree.js';
import { FindingsList } from '../blocks/findings-list.js';
import { InputsList } from '../blocks/inputs-list.js';
import { OutputsList } from '../blocks/outputs-list.js';
import { PapersList } from '../blocks/papers-list.js';
import { InventoryOutline, InventorySection } from '../blocks/section.js';
import { sectionKind, type InventorySectionId } from '../model/kind.js';

export const DEFAULT_SECTIONS: readonly InventorySectionId[] = ['outputs', 'decisions', 'inputs', 'findings', 'papers'];

export interface InventoryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  document: ResolvedAnalysis;
  /** Pass a prebuilt index to share it with the host; otherwise one is derived from `document`. */
  index?: ResolvedAnalysisIndex | undefined;
  /** Universe selection is client-side over the complete resolved report. */
  universeRef?: string | undefined;
  defaultUniverseRef?: string | undefined;
  onUniverseChange?: ((ref: string) => void) | undefined;
  /** The SDK status report; statuses are looked up by the result each output is shown with. */
  statusReport?: StatusReport | undefined;
  /** Controlled analysis selection; pair with `onSelectAnalysis`. Omit to let Inventory navigate internally. Unknown paths show the root. */
  analysisKey?: string | undefined;
  /** Observe navigation, or update `analysisKey` when controlling selection. */
  onSelectAnalysis?: ((key: string) => void) | undefined;
  /** Which sections to show, in order. */
  sections?: readonly InventorySectionId[] | undefined;
  /** Prefix for section anchor ids, so several explorers can share a page. */
  idPrefix?: string | undefined;
  showOutline?: boolean | undefined;
  /** Show project navigation below the outline (default true). Hosts controlling `analysisKey` must pair it with `onSelectAnalysis`. */
  showHierarchy?: boolean | undefined;
  labels?: AstraLabelOverrides | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  /** Host renderer for recorded output provenance, shown below Recipe. */
  renderProvenance?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  /** Host-provided link to the current code file, shown beside Recipe. */
  renderCodeLink?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  renderText?: TextRenderer | undefined;
  loadPdfJs?: PdfJsLoader | undefined;
  onOpenPaperFile?: OpenPaperFileHandler | undefined;
  onOpenArtifact?: ((output: Output) => void | Promise<void>) | undefined;
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
    : entry.ref.split('.').at(-1) ?? entry.ref;
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

const ExplorerBody = forwardRef<HTMLDivElement, Omit<InventoryProps, 'labels'>>(function ExplorerBody(
  {
    document,
    index: providedIndex,
    universeRef: controlledUniverse,
    defaultUniverseRef,
    onUniverseChange,
    statusReport,
    analysisKey,
    onSelectAnalysis,
    sections = DEFAULT_SECTIONS,
    idPrefix = '',
    showOutline = true,
    showHierarchy = true,
    renderArtifact,
    renderProvenance,
    renderCodeLink,
    renderText,
    loadPdfJs,
    onOpenPaperFile,
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
  },
  ref,
) {
  const labels = useLabels();
  const index = useMemo(() => providedIndex ?? indexResolvedAnalysis(document), [document, providedIndex]);
  const [internalAnalysisPath, setInternalAnalysisPath] = useState('');
  // Reset a removed selection so reintroducing that path does not navigate back.
  if (analysisKey === undefined && internalAnalysisPath !== '' && !index.analysisByKey.has(internalAnalysisPath)) {
    setInternalAnalysisPath('');
  }
  const analysis = index.analysisByKey.get(analysisKey ?? internalAnalysisPath) ?? index.analysisByKey.get('');
  if (!analysis) throw new Error('Resolved report has no root analysis');
  const universes = document.analyses.flatMap((candidate) => candidate.universes);
  const firstUniverse = index.analysisByKey.get('')?.universes[0]?.ref ?? universes[0]?.ref;
  const [internalUniverse, setInternalUniverse] = useState(defaultUniverseRef ?? firstUniverse);
  const requestedUniverse = controlledUniverse ?? internalUniverse;
  const universeRef = universes.some((candidate) => candidate.ref === requestedUniverse)
    ? requestedUniverse
    : firstUniverse;
  const universe = universes.find((candidate) => candidate.ref === universeRef);
  if (controlledUniverse === undefined && internalUniverse !== universeRef) setInternalUniverse(universeRef);
  const selectUniverse = (ref: string) => {
    if (controlledUniverse === undefined) setInternalUniverse(ref);
    onUniverseChange?.(ref);
  };
  const selectAnalysis = (path: string) => {
    if (analysisKey === undefined) setInternalAnalysisPath(path);
    onSelectAnalysis?.(path);
  };
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
  const lastAnalysis = useRef(analysis.key);
  useEffect(() => {
    const analysisChanged = lastAnalysis.current !== analysis.key;
    lastAnalysis.current = analysis.key;
    if (analysisChanged && detail === undefined) {
      if (stack.stack.length) stack.close();
      return;
    }
    const resolves = (entry: DetailEntry) => {
      const owner = index.analysisByKey.get(entry.analysisKey);
      if (!owner) return false;
      if (entry.kind === 'paper') return Boolean(findPaper(papers, entry.doi) ?? paperForDoi(document, index, owner, entry.doi, paperMetadata));
      return Boolean(locateRecord(index, entry.ref));
    };
    const next = stack.stack.filter(resolves);
    if (next.length !== stack.stack.length) stack.set(next);
  }, [analysis.key, detail, document, index, paperMetadata, papers, stack]);

  const openRecord = (record: AstraRecord, owner: Analysis) => {
    stack.openRecord(record, owner);
  };

  const sectionContent: Record<InventorySectionId, { count: number; content: ReactNode }> = {
    outputs: {
      count: analysis.outputs.length,
      content: (
        <OutputsList
          analysis={analysis}
          index={index}
          universeRef={universeRef}
          statusReport={statusReport}
          renderArtifact={renderArtifact}
          onOpenRecord={openRecord}
        />
      ),
    },
    decisions: {
      count: analysis.decisions.length,
      content: (
        <DecisionsList
          analysis={analysis}
          universe={universe}
          tagLabels={decisionTagLabels}
          onOpenRecord={openRecord}
        />
      ),
    },
    inputs: {
      count: analysis.inputs.length,
      content: <InputsList analysis={analysis} onOpenRecord={openRecord} />,
    },
    findings: {
      count: analysis.findings.length,
      content: <FindingsList analysis={analysis} onOpenRecord={openRecord} />,
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
  const anchorId = (section: InventorySectionId) => `${idPrefix}${section}`;

  return (
    <div data-slot="inventory" {...rest} ref={ref} className={cn('astra-inventory', className)}>
      {universes.length ? (
        <label className="astra-inventory__universe">
          {labels.universe}
          <select value={universeRef} onChange={(event) => { selectUniverse(event.target.value); }}>
            {universes.map((candidate) => (
              <option key={candidate.ref} value={candidate.ref}>
                {candidate.label ?? candidate.ref}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="astra-inventory__layout" data-sidebar={showOutline || showHierarchy ? '' : undefined}>
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
        {showOutline || showHierarchy ? (
          <div className="astra-inventory__sidebar" data-has-tree={showHierarchy ? '' : undefined}>
            {showOutline ? <InventoryOutline
              entries={sections.map((section) => ({
                id: anchorId(section),
                label: labels.sections[section],
                count: sectionContent[section].count,
                kind: sectionKind(section),
              }))}
            /> : null}
            {showHierarchy ? (
              <AnalysisTree document={document} analysisKey={analysis.key} onSelectAnalysis={selectAnalysis} />
            ) : null}
          </div>
        ) : null}
      </div>
      {stack.active ? (
        <DialogProvider mode={detailMode} backText={stack.previous ? entryLabel(stack.previous, papers) : undefined}>
          <RecordDialog
            entry={stack.active}
            fallback={<p>{labels.notFound}</p>}
            document={document}
            index={index}
            universeRef={universeRef}
            statusReport={statusReport}
            papers={papers}
            paperMetadata={paperMetadata}
            renderArtifact={renderArtifact}
            renderProvenance={renderProvenance}
            renderCodeLink={renderCodeLink}
            renderText={renderText}
            loadPdfJs={loadPdfJs}
            onOpenPaperFile={onOpenPaperFile}
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
