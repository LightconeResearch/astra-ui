import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Every user-facing string the components render, overridable per host. */
export interface AstraLabels {
  sections: {
    outputs: string;
    decisions: string;
    inputs: string;
    findings: string;
    papers: string;
  };
  outline: string;
  analysisTree: string;
  currentAnalysis: string;
  selectAnalysis: string;
  back: string;
  backTo: string;
  close: string;
  notFound: string;
  closeRecord: (kindLabel: string) => string;
  /** The count shown beside a section heading, e.g. "65 outputs". */
  sectionCount: (section: keyof AstraLabels['sections'], count: number) => string;
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
  /** PDF reading, evidence navigation, and accessible viewer controls. */
  pdf: {
    loading: string;
    loadError: string;
    unavailable: string;
    searching: string;
    quoteNotFound: string;
    pages: string;
    zoomIn: string;
    zoomOut: string;
    zoomLevel: (percent: number) => string;
    viewer: (title: string) => string;
    page: (page: number) => string;
    pageError: (page: number) => string;
    pageCount: (count: number) => string;
    quoteHighlighted: (page: number, count: number) => string;
    partialQuoteHighlighted: (page: number, count: number) => string;
    citedPageFallback: (page: number, count: number) => string;
    locatePassage: (passage: number) => string;
  };
  /** Copy used only by the compact RecordPreview surface. */
  preview: {
    optionDetail: string;
    supportedBy: string;
    evidence: string;
    provenance: string;
    source: string;
    openRecord: (kindLabel: string, recordLabel: string) => string;
    optionStatus: (selected: boolean, excluded: boolean) => string;
    remainingDecisionDetails: (count: number) => string;
    valueSource: (product: string) => string;
  };
}

const SECTION_NOUNS: Record<keyof AstraLabels['sections'], [string, string]> = {
  outputs: ['output', 'outputs'],
  decisions: ['decision', 'decisions'],
  inputs: ['input', 'inputs'],
  findings: ['finding', 'findings'],
  papers: ['paper', 'papers'],
};

export const defaultLabels: AstraLabels = {
  sections: {
    outputs: 'Outputs',
    decisions: 'Decisions',
    inputs: 'Inputs',
    findings: 'Findings',
    papers: 'Papers',
  },
  outline: 'On this page',
  analysisTree: 'Project hierarchy',
  currentAnalysis: 'Current analysis',
  selectAnalysis: 'Select an analysis',
  back: 'Back',
  backTo: 'Back to previous record',
  close: 'Close all details',
  closeRecord: (kindLabel) => `Close ${kindLabel.toLowerCase()} details`,
  sectionCount: (section, count) => `${count} ${count === 1 ? SECTION_NOUNS[section][0] : SECTION_NOUNS[section][1]}`,
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
    papers: 'No supporting papers are linked to this analysis.',
  },
  actions: {
    openArtifact: 'Open artifact',
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    fetchPaper: 'Fetch paper',
    openPaper: 'Open',
    locate: 'Locate',
  },
  pdf: {
    loading: 'Loading PDF…',
    loadError: 'The PDF could not be loaded.',
    unavailable: 'Embedded PDF viewing is unavailable. Open the PDF to read it.',
    searching: 'Locating quote in the PDF…',
    quoteNotFound: 'The quoted passage was not found in the PDF text.',
    pages: 'PDF pages',
    zoomIn: 'Zoom PDF in',
    zoomOut: 'Zoom PDF out',
    zoomLevel: (percent) => `${percent}%`,
    viewer: (title) => `PDF viewer for ${title}`,
    page: (page) => `Page ${page}`,
    pageError: (page) => `Page ${page} could not be rendered.`,
    pageCount: (count) => (count === 1 ? '1 page' : `${count} pages`),
    quoteHighlighted: (page, count) => `Quote highlighted on page ${page} of ${count}`,
    partialQuoteHighlighted: (page, count) => `Partial quote highlighted on page ${page} of ${count}`,
    citedPageFallback: (page, count) => `Exact quote not found; showing cited page ${page} of ${count}`,
    locatePassage: (passage) => `Locate source passage ${passage} in paper`,
  },
  preview: {
    optionDetail: 'Option detail',
    supportedBy: 'Supported by',
    evidence: 'Evidence',
    provenance: 'Provenance',
    source: 'Source',
    openRecord: (kindLabel, recordLabel) =>
      `Open ${kindLabel.toLowerCase()} details: ${recordLabel}`,
    optionStatus: (selected, excluded) =>
      `${selected ? 'Selected.' : 'Not selected.'}${excluded ? ' Excluded.' : ''}`,
    remainingDecisionDetails: (count) =>
      `+ ${count} more in the decision details`,
    valueSource: (product) => `from ${product}`,
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
    pdf: { ...base.pdf, ...defined(overrides.pdf ?? {}) },
    preview: { ...base.preview, ...defined(overrides.preview ?? {}) },
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
