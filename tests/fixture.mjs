import { ASTRA_SPEC_VERSION } from '@astra-spec/sdk';

const publishedMethod = {
  id: 'published_method',
  label: 'Published method',
  kind: 'prior_insight',
  canonicalPath: 'prior_insights.published_method',
  claim: 'The fiducial method is established.',
  created_at: '2026-01-01T00:00:00Z',
  evidence: [{
    id: 'paper',
    doi: 'https://doi.org/10.1234/EXAMPLE',
    quote: { exact: 'The fiducial method performs well.' },
    location: { page: 4 },
  }],
};

const methodDecision = {
  id: 'method',
  label: 'Method choice',
  kind: 'decision',
  canonicalPath: 'decisions.method',
  active: true,
  rationale: 'Use the established method.',
  selectedOptionId: 'fiducial',
  options: [
    {
      id: 'fiducial',
      label: 'Fiducial',
      resolvedInsightPaths: ['prior_insights.published_method'],
    },
    { id: 'alternate', label: 'Alternate', resolvedInsightPaths: [] },
  ],
};

const headlineOutput = {
  id: 'headline',
  label: 'Headline result',
  kind: 'output',
  canonicalPath: 'outputs.headline',
  type: 'figure',
  format: 'png',
  description: 'The primary result.',
  active: true,
  inputs: ['catalog'],
  decisions: ['method'],
  provenance: {
    inputPaths: ['inputs.catalog'],
    decisionPaths: ['decisions.method'],
  },
  artifact: { byteSize: 2048 },
};

const clustering = {
  id: 'clustering',
  name: 'Clustering',
  canonicalPath: 'clustering',
  inputs: [],
  outputs: [{
    id: 'correlation',
    label: 'Correlation function',
    kind: 'output',
    canonicalPath: 'clustering.outputs.correlation',
    type: 'table',
    format: 'csv',
    active: true,
    provenance: { inputPaths: ['inputs.catalog'], decisionPaths: [] },
  }],
  decisions: [],
  prior_insights: [{
    id: 'nested_source',
    kind: 'prior_insight',
    canonicalPath: 'clustering.prior_insights.nested_source',
    claim: 'Nested work cites another paper.',
    created_at: '2026-01-02T00:00:00Z',
    evidence: [{ id: 'nested-paper', doi: '10.5678/nested' }],
  }],
  findings: [],
  analyses: [],
};

export const fixtureDocument = {
  schemaVersion: 'astra-resolved-analysis.v1',
  universe: {
    universeId: 'baseline',
    availableUniverseIds: ['baseline'],
    source: 'explicit',
  },
  analysis: {
    version: ASTRA_SPEC_VERSION,
    name: 'DESI demo',
    description: 'A resolved ASTRA project.',
    canonicalPath: '$',
    inputs: [{
      id: 'catalog',
      label: 'Input catalogue',
      kind: 'input',
      canonicalPath: 'inputs.catalog',
      type: 'data',
      source: 'data/catalog.fits',
    }],
    outputs: [
      headlineOutput,
      {
        id: 'summary',
        kind: 'output',
        canonicalPath: 'outputs.summary',
        type: 'report',
        format: 'html',
        active: false,
        provenance: { inputPaths: [], decisionPaths: [] },
      },
    ],
    decisions: [methodDecision],
    prior_insights: [publishedMethod],
    findings: [{
      id: 'headline_finding',
      label: 'Headline finding',
      kind: 'finding',
      canonicalPath: 'findings.headline_finding',
      claim: 'The headline result is significant.',
      created_at: '2026-01-03T00:00:00Z',
      evidence: [{
        id: 'headline-artifact',
        artifact: 'headline',
        resolvedOutputPath: 'outputs.headline',
      }, {
        id: 'finding-paper',
        doi: '10.9999/finding',
      }],
    }],
    analyses: [clustering],
  },
};
