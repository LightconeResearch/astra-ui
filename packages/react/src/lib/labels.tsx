import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Every user-facing string the components render, overridable per host. */
export interface AstraLabels {
  sections: {
    outputs: string;
    decisions: string;
    inputs: string;
    findings: string;
    prior_insights: string;
    papers: string;
  };
  outline: string;
  analysisTree: string;
  back: string;
  backTo: string;
  close: string;
  closeRecord: (kindLabel: string) => string;
  kinds: {
    analysis: string;
    input: string;
    decision: string;
    output: string;
    finding: string;
    prior_insight: string;
    paper: string;
  };
  empty: {
    outputs: string;
    decisions: string;
    inputs: string;
    findings: string;
    prior_insights: string;
    papers: string;
  };
  actions: {
    openArtifact: string;
    fullScreen: string;
    exitFullScreen: string;
    fetchPaper: string;
    openPaper: string;
    locate: string;
  };
}

export const defaultLabels: AstraLabels = {
  sections: {
    outputs: 'Outputs',
    decisions: 'Decisions',
    inputs: 'Inputs',
    findings: 'Findings',
    prior_insights: 'Prior Insights',
    papers: 'Papers',
  },
  outline: 'On this page',
  analysisTree: 'Project hierarchy',
  back: 'Back',
  backTo: 'Back to previous record',
  close: 'Close all details',
  closeRecord: (kindLabel) => `Close ${kindLabel.toLowerCase()} details`,
  kinds: {
    analysis: 'Analysis',
    input: 'Input',
    decision: 'Decision',
    output: 'Output',
    finding: 'Finding',
    prior_insight: 'Insight',
    paper: 'Paper',
  },
  empty: {
    outputs: 'No outputs are declared in this analysis.',
    decisions: 'No decisions are declared in this analysis.',
    inputs: 'No inputs are declared in this analysis.',
    findings: 'No findings are declared in this analysis.',
    prior_insights: 'No prior insights are declared in this analysis.',
    papers: 'No supporting papers are linked to this analysis.',
  },
  actions: {
    openArtifact: 'Open artifact ↗',
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    fetchPaper: 'Fetch paper',
    openPaper: 'Open ↗',
    locate: 'Locate',
  },
};

/** Deep partial of the label set, for host overrides. */
export type AstraLabelOverrides = {
  [K in keyof AstraLabels]?: AstraLabels[K] extends object
    ? AstraLabels[K] extends (...args: never[]) => unknown
      ? AstraLabels[K]
      : Partial<AstraLabels[K]>
    : AstraLabels[K];
};

const LabelsContext = createContext<AstraLabels>(defaultLabels);

export function mergeLabels(overrides: AstraLabelOverrides | undefined): AstraLabels {
  if (!overrides) return defaultLabels;
  return {
    ...defaultLabels,
    ...overrides,
    sections: { ...defaultLabels.sections, ...overrides.sections },
    kinds: { ...defaultLabels.kinds, ...overrides.kinds },
    empty: { ...defaultLabels.empty, ...overrides.empty },
    actions: { ...defaultLabels.actions, ...overrides.actions },
  };
}

export function LabelsProvider({ labels, children }: { labels?: AstraLabelOverrides | undefined; children: ReactNode }) {
  const parent = useContext(LabelsContext);
  const value = useMemo(() => {
    if (!labels) return parent;
    return {
      ...parent,
      ...labels,
      sections: { ...parent.sections, ...labels.sections },
      kinds: { ...parent.kinds, ...labels.kinds },
      empty: { ...parent.empty, ...labels.empty },
      actions: { ...parent.actions, ...labels.actions },
    };
  }, [labels, parent]);
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): AstraLabels {
  return useContext(LabelsContext);
}
