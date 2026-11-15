import { parseResolvedAnalysis, parseStatusReport } from '@astra-spec/sdk/reports';

/** A portable report fixture: transport fields match astra-tools exactly. */
export const fixtureDocument = parseResolvedAnalysis({
  schema_version: 'astra-tools.resolved-analysis.v1',
  spec_version: '0.1.0',
  notes: [],
  analyses: [
    {
      key: '',
      folder: '.',
      label: 'DESI demo',
      description: 'A resolved ASTRA project.',
      tags: [],
      declares: { clustering: 'clustering' },
      inputs: [{ ref: 'inputs.catalog', label: 'Input catalogue', path: 'data/catalog.fits', tags: [] }],
      decisions: [
        {
          ref: 'decisions.method',
          label: 'Method choice',
          rationale: 'Use the established method.',
          tags: [],
          options: [
            { id: 'fiducial', label: 'Fiducial', tags: [], insights: ['prior_insights.published_method'] },
            { id: 'alternate', label: 'Alternate', tags: [], insights: [] },
          ],
        },
      ],
      outputs: [
        {
          ref: 'outputs.headline',
          label: 'Headline result',
          type: 'figure',
          format: 'png',
          description: 'The primary result.',
          tags: [],
          decisions: ['decisions.method'],
        },
        { ref: 'outputs.summary', type: 'report', format: 'html', tags: [], decisions: [] },
      ],
      prior_insights: [
        {
          ref: 'prior_insights.published_method',
          label: 'Published method',
          kind: 'prior_insight',
          claim: 'The fiducial method is established.',
          tags: [],
          evidence: [
            {
              doi: 'https://doi.org/10.1234/EXAMPLE',
              quote: { exact: 'The fiducial method performs well.' },
              location: { value: 'page=4' },
            },
          ],
        },
        {
          ref: 'prior_insights.uncited_caveat',
          label: 'Uncited caveat',
          kind: 'prior_insight',
          claim: 'The method degrades outside the fiducial range.',
          tags: [],
          evidence: [
            {
              doi: 'https://doi.org/10.1234/EXAMPLE',
              quote: { exact: 'Outside this range the method degrades.' },
              location: { value: 'page=9' },
            },
          ],
        },
      ],
      findings: [
        {
          ref: 'findings.headline_finding',
          label: 'Headline finding',
          kind: 'finding',
          claim: 'The headline result is significant.',
          tags: [],
          evidence: [
            { artifact: 'headline', cites: ['outputs.headline#baseline'] },
            { doi: '10.9999/finding' },
          ],
        },
      ],
      universes: [
        { ref: 'universes.baseline', label: 'Baseline', selection: { 'decisions.method': 'fiducial' }, tags: [] },
        { ref: 'universes.alternate', label: 'Alternate', selection: { 'decisions.method': 'alternate' }, tags: [] },
      ],
    },
    {
      key: 'clustering',
      folder: 'clustering',
      label: 'Clustering',
      tags: [],
      declares: {},
      inputs: [],
      decisions: [],
      outputs: [
        {
          ref: 'clustering.outputs.correlation',
          label: 'Correlation function',
          type: 'table',
          format: 'csv',
          tags: [],
          decisions: [],
        },
      ],
      prior_insights: [
        {
          ref: 'clustering.prior_insights.nested_source',
          kind: 'prior_insight',
          claim: 'Nested work cites another paper.',
          tags: [],
          evidence: [{ doi: '10.5678/nested' }],
        },
      ],
      findings: [],
      universes: [],
    },
  ],
  results: [
    {
      id: 'outputs.headline#baseline',
      output: 'outputs.headline',
      universe: 'universes.baseline',
      command: 'python plot.py',
      inputs: [{ entry: 'inputs.catalog', input: 'inputs.catalog' }],
      places: [
        {
          address: 'outputs.headline#baseline',
          record_path: 'results/baseline/headline.prov.json',
          file_path: 'results/baseline/headline.png',
        },
      ],
    },
    {
      id: 'outputs.headline#alternate',
      output: 'outputs.headline',
      universe: 'universes.alternate',
      command: 'python alternative.py',
      inputs: [{ entry: 'inputs.catalog', input: 'inputs.catalog' }],
      places: [
        {
          address: 'outputs.headline#alternate',
          record_path: 'results/alternate/headline.prov.json',
          file_path: 'results/alternate/headline.png',
        },
      ],
    },
    {
      id: 'clustering.outputs.correlation',
      output: 'clustering.outputs.correlation',
      inputs: [{ entry: 'inputs.catalog', input: 'inputs.catalog' }],
      places: [],
    },
  ],
});
export const fixtureStatus = parseStatusReport({
  schema_version: 'astra-tools.status-report.v1',
  inputs: { 'inputs.catalog': { state: 'present' } },
  evidence: [],
  statuses: {
    'outputs.headline#baseline': { state: 'unchanged', bytes: { state: 'present' }, why: [], stale_inputs: [] },
    'outputs.headline#alternate': { state: 'missing', bytes: { state: 'absent' }, why: [], stale_inputs: [] },
  },
});
