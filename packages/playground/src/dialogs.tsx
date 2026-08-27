import type { ResolvedDecision, ResolvedInput, ResolvedInsight, ResolvedOutput } from '@astra-spec/sdk';
import {
  DecisionDialog,
  DialogProvider,
  FindingDialog,
  InputDialog,
  InsightDialog,
  OutputDialog,
  PaperDialog,
  collectInventoryPapers,
  createInventoryIndex,
  decisionInsights,
  findingEvidence,
  informedDecisions,
  outputRelations,
} from '@lightcone-research/astra-ui/components';
import type { ReactNode } from 'react';
import { byPath } from './derive';
import { analysisDocument, paperMetadata, renderArtifact, renderPaper } from './host';

const noop = () => undefined;
const analysis = analysisDocument.analysis;
const index = createInventoryIndex(analysisDocument);
const papers = collectInventoryPapers(analysisDocument, index, analysis, paperMetadata);

function output(path: string) {
  const record = byPath<ResolvedOutput>(analysisDocument, path);
  return (
    <OutputDialog
      record={record}
      relations={outputRelations(index, record)}
      renderArtifact={renderArtifact}
      onOpenArtifact={noop}
      onOpenRecord={noop}
      onClose={noop}
    />
  );
}

const stories: Record<string, () => ReactNode> = {
  OutputFigure: () => output('outputs.bao_fit_plot'),
  OutputTable: () => output('outputs.bao_distance_table'),
  OutputData: () => output('outputs.xi_pre_recon_bgs'),
  Decision: () => {
    const record = byPath<ResolvedDecision>(analysisDocument, 'decisions.smoothing_radius');
    return (
      <DecisionDialog record={record} insights={decisionInsights(index, record)} onOpenInsight={noop} onClose={noop} />
    );
  },
  Finding: () => {
    const record = byPath<ResolvedInsight>(analysisDocument, 'findings.bao_detected_post_recon');
    return (
      <FindingDialog record={record} evidence={findingEvidence(index, record)} onOpenRecord={noop} onClose={noop} />
    );
  },
  Input: () => (
    <InputDialog record={byPath<ResolvedInput>(analysisDocument, 'inputs.desi_dr1_lss_catalogs')} onClose={noop} />
  ),
  Insight: () => {
    const record = byPath<ResolvedInsight>(analysisDocument, 'prior_insights.fog_decoupling_breaks_degeneracy');
    return (
      <InsightDialog
        record={record}
        decisions={informedDecisions(analysisDocument, record)}
        onOpenSource={noop}
        onOpenDecision={noop}
        onClose={noop}
      />
    );
  },
  Paper: () => (
    <PaperDialog record={papers[0]} renderPaper={renderPaper} onFetchPaper={noop} onOpenInsight={noop} onOpenDecision={noop} onClose={noop} />
  ),
  PaperWithoutContent: () => (
    <PaperDialog record={{ ...papers[1], pdfUrl: undefined }} onFetchPaper={noop} onOpenInsight={noop} onOpenDecision={noop} onClose={noop} />
  ),
  WithBackTrail: () => {
    const record = byPath<ResolvedDecision>(analysisDocument, 'decisions.broadband');
    return (
      <DialogProvider mode="modal" backText="BAO fit plot">
        <DecisionDialog
          record={record}
          insights={decisionInsights(index, record)}
          onOpenInsight={noop}
          onBack={noop}
          onClose={noop}
        />
      </DialogProvider>
    );
  },
};

export const dialogStories = stories;
