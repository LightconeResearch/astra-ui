import { useEffect, useMemo, useState } from 'react';
import {
  indexAnalysis,
  normalizeDoi,
  type AnalysisIndex,
  type ResolvedAnalysisDocument,
  type ResolvedAnalysisNode,
  type ResolvedDecision,
  type ResolvedInsight,
  type ResolvedOutput,
  type ResolvedRecord,
} from '@astra-spec/sdk';
import type { ArtifactRenderer } from '../artifact-preview.js';
import type { TextRenderer } from './InventoryProse.js';
import { DecisionDialog, DecisionsInventory } from './DecisionsInventory.js';
import {
  FindingDialog,
  FindingsInventory,
  type FindingEvidenceLink,
} from './FindingsInventory.js';
import { InputDialog, InputsInventory } from './InputsInventory.js';
import { InsightDetailDialog } from './InsightDetailDialog.js';
import {
  InventoryDetailPresentation,
  type InventoryDetailMode,
} from './InventoryPrimitives.js';
import {
  OutputDialog,
  OutputsInventory,
  type LinkedRecord,
  type OutputRelations,
} from './OutputsInventory.js';
import { PriorInsightsInventory } from './PriorInsightsInventory.js';
import {
  collectInventoryPapers,
  PaperDialog,
  PapersInventory,
  type InventoryPaper,
  type InventoryPaperMetadataMap,
  type PaperRenderer,
} from './PapersInventory.js';
import {
  decisionInsights,
  informedDecisions,
  locateRecord,
  recordTitle,
} from './inventory-data.js';

const EMPTY_PAPER_METADATA: InventoryPaperMetadataMap = {};

type InventoryDetailEntry =
  | { kind: 'record'; canonicalPath: string; analysisPath: string }
  | {
      kind: 'paper';
      doi: string;
      analysisPath: string;
      focusInsightPath?: string | undefined;
    };

function entryLabel(entry: InventoryDetailEntry, papers: InventoryPaper[]): string {
  return entry.kind === 'paper'
    ? papers.find(({ doi }) => normalizeDoi(doi) === normalizeDoi(entry.doi))?.title ?? entry.doi
    : entry.canonicalPath.split('.').at(-1) ?? entry.canonicalPath;
}

function linkedRecord(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  canonicalPath: string,
): LinkedRecord {
  const located = locateRecord(document, index, canonicalPath);
  return {
    canonicalPath,
    ...(located ? { record: located.record, analysis: located.analysis } : {}),
  };
}

function outputRelations(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  output: ResolvedOutput,
): OutputRelations {
  return {
    inputs: output.provenance.inputPaths.map((path) => linkedRecord(document, index, path)),
    decisions: output.provenance.decisionPaths.map((path) => linkedRecord(document, index, path)),
    ...(output.resolvedFrom
      ? { alias: linkedRecord(document, index, output.resolvedFrom) }
      : {}),
  };
}

function findingEvidence(
  document: ResolvedAnalysisDocument,
  index: AnalysisIndex,
  finding: ResolvedInsight,
): FindingEvidenceLink[] {
  return finding.evidence
    .filter((evidence) => evidence.artifact || evidence.resolvedOutputPath)
    .map((evidence) => {
      const located = evidence.resolvedOutputPath
        ? locateRecord(document, index, evidence.resolvedOutputPath)
        : undefined;
      const output = located?.record.kind === 'output' ? located.record : undefined;
      return {
        evidence,
        ...(output && located ? { output, analysis: located.analysis } : {}),
      };
    });
}

interface InventoryRecordDetailProps {
  entry: InventoryDetailEntry;
  analysis: ResolvedAnalysisNode;
  document: ResolvedAnalysisDocument;
  index: AnalysisIndex;
  papers: InventoryPaper[];
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  onFetchPaper?: ((doi: string) => void) | undefined;
  onPush: (entry: InventoryDetailEntry) => void;
  onBack?: (() => void) | undefined;
  onClose: () => void;
}

function InventoryRecordDetail({
  entry,
  analysis,
  document,
  index,
  papers,
  renderArtifact,
  renderText,
  renderPaper,
  onOpenArtifact,
  onFetchPaper,
  onPush,
  onBack,
  onClose,
}: InventoryRecordDetailProps) {
  const openRecord = (record: ResolvedRecord, owner: ResolvedAnalysisNode) => {
    onPush({
      kind: 'record',
      canonicalPath: record.canonicalPath,
      analysisPath: owner.canonicalPath,
    });
  };

  if (entry.kind === 'paper') {
    const paper = papers.find(({ doi }) => normalizeDoi(doi) === normalizeDoi(entry.doi));
    if (!paper) return null;
    const focusRecord = entry.focusInsightPath
      ? index.recordByPath.get(entry.focusInsightPath)
      : undefined;
    const focusInsight = focusRecord?.kind === 'prior_insight' || focusRecord?.kind === 'finding'
      ? focusRecord
      : undefined;
    return (
      <PaperDialog
        paper={paper}
        analysis={analysis}
        initialFocusInsight={focusInsight}
        renderText={renderText}
        renderPaper={renderPaper}
        onFetchPaper={onFetchPaper}
        onOpenInsight={(insight) => {
          const located = locateRecord(document, index, insight.canonicalPath);
          if (located) openRecord(located.record, located.analysis);
        }}
        onOpenDecision={(decision) => {
          const located = locateRecord(document, index, decision.canonicalPath);
          if (located) openRecord(located.record, located.analysis);
        }}
        onBack={onBack}
        onClose={onClose}
      />
    );
  }

  const located = locateRecord(document, index, entry.canonicalPath);
  if (!located) return null;
  const { record } = located;
  switch (record.kind) {
    case 'output':
      return (
        <OutputDialog
          output={record}
          analysis={analysis}
          relations={outputRelations(document, index, record)}
          renderArtifact={renderArtifact}
          renderText={renderText}
          onOpenArtifact={onOpenArtifact}
          onOpenDependency={openRecord}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'input':
      return (
        <InputDialog
          record={record}
          analysis={analysis}
          renderText={renderText}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'decision':
      return (
        <DecisionDialog
          record={record}
          analysis={analysis}
          insights={decisionInsights(index, record)}
          renderText={renderText}
          onOpenInsight={(insight) => {
            const target = locateRecord(document, index, insight.canonicalPath);
            if (target) openRecord(target.record, target.analysis);
          }}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'finding':
      return (
        <FindingDialog
          record={record}
          analysis={analysis}
          evidence={findingEvidence(document, index, record)}
          renderText={renderText}
          onOpenEvidence={openRecord}
          onBack={onBack}
          onClose={onClose}
        />
      );
    case 'prior_insight': {
      const sourceDoi = record.evidence.find(({ doi }) => doi)?.doi;
      const sourcePaper = sourceDoi
        ? papers.find(({ doi }) => normalizeDoi(doi) === normalizeDoi(sourceDoi))
        : undefined;
      return (
        <InsightDetailDialog
          insight={record}
          analysis={analysis}
          decisions={informedDecisions(document, record)}
          renderText={renderText}
          onOpenSource={sourcePaper ? () => onPush({
            kind: 'paper',
            doi: sourcePaper.doi,
            analysisPath: analysis.canonicalPath,
            focusInsightPath: record.canonicalPath,
          }) : undefined}
          onOpenDecision={(decision) => {
            const target = locateRecord(document, index, decision.canonicalPath);
            if (target) openRecord(target.record, target.analysis);
          }}
          onBack={onBack}
          onClose={onClose}
        />
      );
    }
  }
}

export interface InventoryExplorerProps {
  document: ResolvedAnalysisDocument;
  /** Canonical analysis path; `$` selects the project root. */
  analysisPath?: string | undefined;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  renderPaper?: PaperRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  paperMetadata?: InventoryPaperMetadataMap | undefined;
  /** Notify the host to fetch this DOI; update paperMetadata when complete. */
  onFetchPaper?: ((doi: string) => void) | undefined;
  decisionTagLabels?: Readonly<Record<string, string>> | undefined;
  detailMode?: InventoryDetailMode | undefined;
}

export function InventoryExplorer({
  document,
  analysisPath = '$',
  renderArtifact,
  renderText,
  renderPaper,
  onOpenArtifact,
  paperMetadata = EMPTY_PAPER_METADATA,
  onFetchPaper,
  decisionTagLabels = {},
  detailMode = 'modal',
}: InventoryExplorerProps) {
  const index = useMemo(() => indexAnalysis(document), [document]);
  const analysis = index.analysisByPath.get(analysisPath) ?? document.analysis;
  const papers = useMemo(
    () => collectInventoryPapers(document, index, analysis, paperMetadata),
    [analysis, document, index, paperMetadata],
  );
  const [detailStack, setDetailStack] = useState<InventoryDetailEntry[]>([]);

  useEffect(() => setDetailStack([]), [analysis.canonicalPath]);
  const startDetail = (entry: InventoryDetailEntry) => setDetailStack([entry]);
  const pushDetail = (entry: InventoryDetailEntry) => setDetailStack((stack) => [...stack, entry]);
  const goBack = () => setDetailStack((stack) => stack.slice(0, -1));
  const closeAll = () => {
    setDetailStack([]);
  };
  const activeEntry = detailStack.at(-1);
  const activeAnalysis = activeEntry
    ? index.analysisByPath.get(activeEntry.analysisPath)
    : undefined;
  const previousEntry = detailStack.length > 1 ? detailStack.at(-2) : undefined;
  const modal = activeEntry && activeAnalysis ? (
    <InventoryDetailPresentation
      mode={detailMode}
      backLabel="Back to previous record"
      backText={previousEntry ? entryLabel(previousEntry, papers) : undefined}
    >
      <InventoryRecordDetail
        entry={activeEntry}
        analysis={activeAnalysis}
        document={document}
        index={index}
        papers={papers}
        renderArtifact={renderArtifact}
        renderText={renderText}
        renderPaper={renderPaper}
        onOpenArtifact={onOpenArtifact}
        onFetchPaper={onFetchPaper}
        onPush={pushDetail}
        onBack={detailStack.length > 1 ? goBack : undefined}
        onClose={closeAll}
      />
    </InventoryDetailPresentation>
  ) : null;

  const openRecord = (record: ResolvedRecord, owner: ResolvedAnalysisNode) => startDetail({
    kind: 'record',
    canonicalPath: record.canonicalPath,
    analysisPath: owner.canonicalPath,
  });
  const sections = [
    {
      id: 'outputs',
      label: 'Outputs',
      count: analysis.outputs.length,
      content: (
        <OutputsInventory
          analysis={analysis}
          renderArtifact={renderArtifact}
          onOpenOutput={openRecord}
        />
      ),
    },
    {
      id: 'decisions',
      label: 'Decisions',
      count: analysis.decisions.length,
      content: (
        <DecisionsInventory
          analysis={analysis}
          tagLabels={decisionTagLabels}
          onOpenDecision={openRecord}
        />
      ),
    },
    {
      id: 'inputs',
      label: 'Inputs',
      count: analysis.inputs.length,
      content: <InputsInventory analysis={analysis} onOpenInput={openRecord} />,
    },
    {
      id: 'findings',
      label: 'Findings',
      count: analysis.findings.length,
      content: <FindingsInventory analysis={analysis} onOpenFinding={openRecord} />,
    },
    {
      id: 'prior-insights',
      label: 'Prior Insights',
      count: analysis.prior_insights.length,
      content: <PriorInsightsInventory analysis={analysis} onOpenInsight={openRecord} />,
    },
    {
      id: 'papers',
      label: 'Papers',
      count: papers.length,
      content: (
        <PapersInventory
          papers={papers}
          analysis={analysis}
          onOpenPaper={(paper, owner) => startDetail({
            kind: 'paper',
            doi: paper.doi,
            analysisPath: owner.canonicalPath,
          })}
        />
      ),
    },
  ];

  return (
    <div className="inventory-outline">
      <div className="inventory-page-layout">
        <div className="inventory-outline__sections">
          {sections.map((section) => (
            <section
              key={section.id}
              className={`inventory-outline__section inventory-outline__section--${section.id}`}
            >
              <div className="inventory-section-heading">
                <h2 id={section.id} tabIndex={-1}>
                  <span className="heading-text">{section.label}</span>
                </h2>
                <span>{section.count}</span>
              </div>
              {section.content}
            </section>
          ))}
        </div>
        <aside className="inventory-page-outline" aria-label="Inventory outline">
          <h3>On this page</h3>
          <nav>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                <span>{section.label}</span>
                <span>{section.count}</span>
              </a>
            ))}
          </nav>
        </aside>
      </div>
      {modal}
    </div>
  );
}
