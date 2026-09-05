import { useRecordDetails, RecordDetailsContent, type RecordDetailsProps } from '../components/record-details.js';
import type { ResolvedAnalysisNode, ResolvedRecord } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { LabelsProvider, useLabels } from '../lib/labels.js';
import { DecisionsList } from '../blocks/decisions-list.js';
import { FindingsList } from '../blocks/findings-list.js';
import { InputsList } from '../blocks/inputs-list.js';
import { OutputsList } from '../blocks/outputs-list.js';
import { PapersList } from '../blocks/papers-list.js';
import { InventoryOutline, InventorySection, sectionKind, type InventorySectionId } from '../blocks/section.js';

// Prior insights are not an inventory section; they are reached through the
// decisions and papers that cite them.
export const DEFAULT_SECTIONS: readonly InventorySectionId[] = ['outputs', 'decisions', 'inputs', 'findings', 'papers'];

export interface InventoryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>, RecordDetailsProps {
  sections?: readonly InventorySectionId[] | undefined;
  idPrefix?: string | undefined;
  showOutline?: boolean | undefined;
  decisionTagLabels?: Readonly<Record<string, string>> | undefined;
  children?: ReactNode | undefined;
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
  paperMetadata,
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
  const { index, analysis, papers, stack } = useRecordDetails({
    document, index: providedIndex, analysisPath, paperMetadata, detail, defaultDetail, onDetailChange,
  });

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
      <RecordDetailsContent
        document={document} index={index} papers={papers} stack={stack}
        paperMetadata={paperMetadata} detailMode={detailMode}
        renderArtifact={renderArtifact} renderText={renderText} renderPaper={renderPaper}
        onOpenArtifact={onOpenArtifact} onFetchPaper={onFetchPaper}
      />
    </div>
  );
});
