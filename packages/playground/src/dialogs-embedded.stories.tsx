import { indexAnalysis, type ResolvedDecision, type ResolvedOutput } from '@astra-spec/sdk';
import type { Story } from '@ladle/react';
import { DecisionDialog, OutputDialog, PaperDialog } from '@astra-spec/ui/components';
import { collectInventoryPapers, decisionInsights, outputRelations } from '@astra-spec/ui/model';
import { DialogProvider } from '@astra-spec/ui/primitives';
import { byPath } from './derive';
import { analysisDocument, paperMetadata, renderArtifact, renderPaper } from './host';

// The embedded shell is what jupyterlab-astra mounts. The demo paper preview
// opens every record kind as a modal, so only what is specific to embedding
// stays here: an artifact-bearing output, the paper body, and the back trail.
export default { title: 'Dialogs / Embedded' };

const noop = () => undefined;
const index = indexAnalysis(analysisDocument);

export const OutputFigure: Story = () => {
  const record = byPath<ResolvedOutput>(analysisDocument, 'outputs.bao_fit_plot');
  return (
    <DialogProvider mode="embedded">
      <OutputDialog
        record={record}
        relations={outputRelations(index, record)}
        renderArtifact={renderArtifact}
        onOpenArtifact={noop}
        onOpenRecord={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

export const Paper: Story = () => {
  const [paper] = collectInventoryPapers(analysisDocument, index, analysisDocument.analysis, paperMetadata);
  if (!paper) throw new Error('Fixture has no papers');
  return (
    <DialogProvider mode="embedded">
      <PaperDialog
        record={paper}
        renderPaper={renderPaper}
        onFetchPaper={noop}
        onOpenInsight={noop}
        onOpenDecision={noop}
        onClose={noop}
      />
    </DialogProvider>
  );
};

export const WithBackTrail: Story = () => {
  const record = byPath<ResolvedDecision>(analysisDocument, 'decisions.broadband');
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
