import { indexAnalysis, type AnalysisIndex, type ResolvedAnalysisDocument, type ResolvedOutput } from '@astra-spec/sdk';
import { useEffect, useMemo, useRef } from 'react';
import { collectInventoryPapers, findPaper, paperForDoi, type InventoryPaper, type InventoryPaperMetadataMap } from '../model/papers.js';
import { locateRecord } from '../model/locate-record.js';
import { LabelsProvider, useLabels, type AstraLabelOverrides } from '../lib/labels.js';
import { DialogProvider, type DialogMode } from '../primitives/dialog.js';
import type { TextRenderer } from '../primitives/prose.js';
import type { DetailEntry } from './detail-entry.js';
import type { PaperRenderer } from './paper-detail.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { RecordDialog } from './record-dialog.js';
import { useDetailStack, type DetailStack } from './use-detail-stack.js';

export interface RecordDetailsProps {
  document: ResolvedAnalysisDocument;
  /** Pass a prebuilt index to share it with the host; otherwise one is derived from `document`. */
  index?: AnalysisIndex | undefined;
  /** Canonical analysis path; `$` selects the project root. A path the document does not contain shows the root. */
  analysisPath?: string | undefined;
  labels?: AstraLabelOverrides | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  /** Notify the host to fetch this DOI; update paperMetadata when complete. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  detailMode?: DialogMode | undefined;
  /** The open detail stack (controlled); pair with `onDetailChange`. */
  detail?: DetailEntry[] | undefined;
  defaultDetail?: DetailEntry[] | undefined;
  onDetailChange?: ((next: DetailEntry[]) => void) | undefined;

}

const EMPTY_PAPER_METADATA: InventoryPaperMetadataMap = {};

function entryLabel(entry: DetailEntry, papers: readonly InventoryPaper[]): string {
  return entry.kind === 'paper'
    ? findPaper(papers, entry.doi)?.title ?? entry.doi
    : entry.canonicalPath.split('.').at(-1) ?? entry.canonicalPath;
}

export function useRecordDetails({
  document, index: providedIndex, analysisPath = '$',
  paperMetadata = EMPTY_PAPER_METADATA, detail, defaultDetail, onDetailChange,
}: RecordDetailsProps) {
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
    const resolves = (entry: DetailEntry) => {
      const owner = index.analysisByPath.get(entry.analysisPath);
      if (!owner) return false;
      if (entry.kind === 'paper') return Boolean(findPaper(papers, entry.doi) ?? paperForDoi(document, index, owner, entry.doi, paperMetadata));
      return Boolean(locateRecord(index, entry.canonicalPath));
    };
    const next = stack.stack.filter(resolves);
    if (next.length !== stack.stack.length) stack.set(next);
  }, [analysis.canonicalPath, detail, document, index, paperMetadata, papers, stack]);


  return { document, index, analysis, papers, stack };
}

/** Internal composition shared by the inventory and the standalone surface. */
export function RecordDetailsContent({
  document, index, papers, stack, paperMetadata,
  renderArtifact, renderText, renderPaper, onOpenArtifact, onFetchPaper,
  detailMode = 'modal',
}: RecordDetailsProps & { index: AnalysisIndex; papers: InventoryPaper[]; stack: DetailStack }) {
  const labels = useLabels();
  return (
    <>
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
    </>
  );
}

function DetailsBody(props: RecordDetailsProps) {
  const state = useRecordDetails(props);
  return <RecordDetailsContent {...props} {...state} />;
}

/** A detail stack without inventory sections or page layout. */
export function RecordDetails({ labels, ...props }: RecordDetailsProps) {
  return <LabelsProvider labels={labels}><DetailsBody {...props} /></LabelsProvider>;
}
