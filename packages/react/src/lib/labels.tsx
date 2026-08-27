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
  notFound: string;
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
  notFound: 'This record is no longer available.',
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
  [K in keyof AstraLabels]?: (AstraLabels[K] extends object
    ? AstraLabels[K] extends (...args: never[]) => unknown
      ? AstraLabels[K]
      : { [P in keyof AstraLabels[K]]?: AstraLabels[K][P] | undefined }
    : AstraLabels[K]) | undefined;
};

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined)) as Partial<T>;
}

const LabelsContext = createContext<AstraLabels>(defaultLabels);

function merge(base: AstraLabels, overrides: AstraLabelOverrides): AstraLabels {
  return {
    ...base,
    ...defined(overrides),
    sections: { ...base.sections, ...defined(overrides.sections ?? {}) },
    kinds: { ...base.kinds, ...defined(overrides.kinds ?? {}) },
    empty: { ...base.empty, ...defined(overrides.empty ?? {}) },
    actions: { ...base.actions, ...defined(overrides.actions ?? {}) },
  } as AstraLabels;
}

export function mergeLabels(overrides: AstraLabelOverrides | undefined): AstraLabels {
  return overrides ? merge(defaultLabels, overrides) : defaultLabels;
}

export interface LabelsProviderProps {
  labels?: AstraLabelOverrides | undefined;
  children: ReactNode;
}

export function LabelsProvider({ labels, children }: LabelsProviderProps) {
  const parent = useContext(LabelsContext);
  const value = useMemo(() => (labels ? merge(parent, labels) : parent), [labels, parent]);
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): AstraLabels {
  return useContext(LabelsContext);
}
