import type { Story } from '@ladle/react';
import { indexAnalysis, type ResolvedDecision, type ResolvedInput, type ResolvedInsight, type ResolvedOutput } from '@astra-spec/sdk';
import {
  DecisionDialog,
  FindingDialog,
  InputDialog,
  InsightDetailDialog,
  InventoryDetailPresentation,
  OutputDialog,
  PaperDialog,
  collectInventoryPapers,
} from '@lightcone-research/astra-ui/components';
import type { ReactNode } from 'react';
import { byPath, decisionInsights, findingEvidence, informedDecisions, outputRelations } from './derive';
import { analysisDocument, paperMetadata, renderArtifact, renderPaper } from './host';

const noop = () => undefined;
const analysis = analysisDocument.analysis;
const index = indexAnalysis(analysisDocument);
const papers = collectInventoryPapers(analysisDocument, index, analysis, paperMetadata);

function output(path: string) {
  const record = byPath<ResolvedOutput>(analysisDocument, path);
  return (
    <OutputDialog
      output={record}
      analysis={analysis}
      relations={outputRelations(analysisDocument, record)}
      renderArtifact={renderArtifact}
      onOpenArtifact={noop}
      onOpenDependency={noop}
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
      <DecisionDialog
        record={record}
        analysis={analysis}
        insights={decisionInsights(analysisDocument, record)}
        onOpenInsight={noop}
        onClose={noop}
      />
    );
  },
  Finding: () => {
    const record = byPath<ResolvedInsight>(analysisDocument, 'findings.bao_detected_post_recon');
    return (
      <FindingDialog
        record={record}
        analysis={analysis}
        evidence={findingEvidence(analysisDocument, record)}
        onOpenEvidence={noop}
        onClose={noop}
      />
    );
  },
  Input: () => (
    <InputDialog
      record={byPath<ResolvedInput>(analysisDocument, 'inputs.desi_dr1_lss_catalogs')}
      analysis={analysis}
      onClose={noop}
    />
  ),
  Insight: () => {
    const record = byPath<ResolvedInsight>(analysisDocument, 'prior_insights.fog_decoupling_breaks_degeneracy');
    return (
      <InsightDetailDialog
        insight={record}
        analysis={analysis}
        decisions={informedDecisions(analysisDocument, record)}
        onOpenSource={noop}
        onOpenDecision={noop}
        onClose={noop}
      />
    );
  },
  Paper: () => (
    <PaperDialog
      paper={papers[0]}
      analysis={analysis}
      renderPaper={renderPaper}
      onFetchPaper={noop}
      onOpenInsight={noop}
      onOpenDecision={noop}
      onClose={noop}
    />
  ),
  PaperWithoutContent: () => (
    <PaperDialog
      paper={{ ...papers[1], pdfUrl: undefined }}
      analysis={analysis}
      onFetchPaper={noop}
      onOpenInsight={noop}
      onOpenDecision={noop}
      onClose={noop}
    />
  ),
  WithBackTrail: () => {
    const record = byPath<ResolvedDecision>(analysisDocument, 'decisions.broadband');
    return (
      <InventoryDetailPresentation mode="modal" backText="BAO fit plot">
        <DecisionDialog
          record={record}
          analysis={analysis}
          insights={decisionInsights(analysisDocument, record)}
          onOpenInsight={noop}
          onBack={noop}
          onClose={noop}
        />
      </InventoryDetailPresentation>
    );
  },
};

export const dialogStories = stories;
