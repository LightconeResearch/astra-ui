import type { Decision, Output } from '@astra-spec/sdk/reports';
import type { Story } from '@ladle/react';
import { ArtifactPreview, DecisionDialog, OutputDialog, PaperDialog } from '@astra-spec/ui/components';
import { collectInventoryPapers, decisionInsights, outputRelations, outputResult } from '@astra-spec/ui/model';
import { DialogProvider } from '@astra-spec/ui/primitives';
import { byRef } from './derive';
import { analysisDocument, analysisRoot, defaultUniverse, index, loadPdfJs, paperMetadata, renderArtifact, statusReport } from './host';

// The embedded shell is what jupyterlab-astra mounts. The demo paper preview
// opens every record kind as a modal, so only what is specific to embedding
// stays here: an artifact-bearing output, a metric, the paper body, and the
// back trail.
export default { title: 'Dialogs / Embedded' };

const noop = () => undefined;

export const OutputFigure: Story = () => {
  const record = byRef<Output>(analysisDocument, 'outputs.bao_fit_plot');
  const result = outputResult(index, record, defaultUniverse);
  return (
    <DialogProvider mode="embedded">
      <OutputDialog
        record={record}
        relations={outputRelations(index, record, defaultUniverse)}
        result={result}
        status={result ? statusReport.statuses[result.id] : undefined}
        universeRef={defaultUniverse}
        renderArtifact={renderArtifact}
        onOpenArtifact={noop}
        onOpenRecord={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

// The fixture ships no metric artifact, so this stands in for the host that
// reads one: a metric has no picture to frame, and its value is a pill in the
// provenance rather than a figure stretched across a reader column.
const renderMetric = (output: Output, { compact }: { compact: boolean }) => (
  <ArtifactPreview
    output={output}
    compact={compact}
    preview={{ kind: 'metric', value: 8.8134, uncertainty: 0.12, unit: 'Mpc/h', label: 'Mean displacement' }}
  />
);

export const OutputMetric: Story = () => {
  const record = byRef<Output>(analysisDocument, 'reconstruction.outputs.mean_displacement_bgs_full');
  return (
    <DialogProvider mode="embedded">
      <OutputDialog
        record={record}
        relations={outputRelations(index, record, defaultUniverse)}
        result={outputResult(index, record, defaultUniverse)}
        universeRef={defaultUniverse}
        renderArtifact={renderMetric}
        onOpenArtifact={noop}
        onOpenRecord={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

export const Paper: Story = () => {
  const [paper] = collectInventoryPapers(analysisDocument, index, analysisRoot, paperMetadata);
  if (!paper) throw new Error('Fixture has no papers');
  return (
    <DialogProvider mode="embedded">
      <PaperDialog
        record={paper}
        loadPdfJs={loadPdfJs}
        onFetchPaper={noop}
        onOpenInsight={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

// The rail's decision picker only exists on a paper some decision cites, and
// the first fixture paper is cited by none: without this story no screenshot
// covers the picker, its decision mark, or the open action beside it.
export const PaperInformingDecisions: Story = () => {
  const papers = collectInventoryPapers(analysisDocument, index, analysisRoot, paperMetadata);
  const paper = papers.find((candidate) => candidate.decisions.length > 1);
  if (!paper) throw new Error('Fixture has no paper informing more than one decision');
  return (
    <DialogProvider mode="embedded">
      <PaperDialog
        record={paper}
        loadPdfJs={loadPdfJs}
        onFetchPaper={noop}
        onOpenInsight={noop}
        onOpenDecision={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

export const WithBackTrail: Story = () => {
  const record = byRef<Decision>(analysisDocument, 'decisions.broadband');
  return (
    <DialogProvider mode="embedded" backText="BAO fit plot">
      <DecisionDialog
        record={record}
        insights={decisionInsights(index, record)}
        onOpenInsight={noop}
        onBack={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};
