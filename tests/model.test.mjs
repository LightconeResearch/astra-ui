import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProjectViewModelIndex,
  validateProjectViewModel,
} from '../packages/react/dist/core.js';

/**
 * Canonical project-view-model.v1 fixture shared by model and React tests.
 */
const canonicalFixture = {
  schemaVersion: 'project-view-model.v1',
  revision: { analysis: 'fixture-analysis' },
  project: {
    id: 'desi-demo',
    name: 'DESI demo',
    description: 'A small nested ASTRA viewer fixture.',
  },
  selection: {
    availableUniverses: [],
    decisions: {
      'root:decision:method': 'fiducial',
      'clustering:decision:weighting': 'fkp',
    },
    source: 'unknown',
  },
  scopes: [
    {
      id: 'root',
      canonicalPath: 'root',
      name: 'DESI demo',
      childIds: ['clustering'],
      recordIds: [
        'root:input:catalog',
        'root:decision:method',
        'root:prior_insight:published_method',
        'root:output:headline',
      ],
    },
    {
      id: 'clustering',
      canonicalPath: 'clustering',
      name: 'Clustering',
      parentId: 'root',
      childIds: [],
      recordIds: [
        'clustering:input:headline_alias',
        'clustering:decision:method_alias',
        'clustering:decision:weighting',
        'clustering:output:xi',
      ],
    },
  ],
  records: [
    {
      id: 'root:input:catalog',
      localId: 'catalog',
      canonicalPath: 'inputs.catalog',
      scopeId: 'root',
      kind: 'input',
      description: 'Input catalogue.',
      relations: [],
      inputType: 'data',
    },
    {
      id: 'root:decision:method',
      localId: 'method',
      canonicalPath: 'decisions.method',
      scopeId: 'root',
      kind: 'decision',
      relations: [],
      selectedOptionId: 'fiducial',
      options: [
        {
          id: 'fiducial',
          label: 'Fiducial',
          selected: true,
          insightRecordIds: ['root:prior_insight:published_method'],
        },
        { id: 'alternate', label: 'Alternate', selected: false },
      ],
    },
    {
      id: 'root:prior_insight:published_method',
      localId: 'published_method',
      canonicalPath: 'prior_insights.published_method',
      scopeId: 'root',
      kind: 'prior_insight',
      relations: [],
      claim: 'The method is established.',
      evidence: [{ doi: '10.0000/example' }],
    },
    {
      id: 'root:output:headline',
      localId: 'headline',
      canonicalPath: 'outputs.headline',
      scopeId: 'root',
      kind: 'output',
      relations: [
        {
          kind: 'depends_on',
          targetRecordId: 'clustering:output:xi',
          direct: true,
        },
        {
          kind: 'depends_on',
          targetRecordId: 'root:input:catalog',
          direct: false,
        },
        {
          kind: 'parameterized_by',
          targetRecordId: 'root:decision:method',
          direct: true,
        },
        {
          kind: 'parameterized_by',
          targetRecordId: 'clustering:decision:weighting',
          direct: false,
        },
      ],
      outputType: 'figure',
      recipe: {
        command: 'python scripts/render_headline.py --output {output}',
      },
      resourceIds: ['resource:headline'],
      provenance: {
        inputs: [
          {
            reference: 'clustering.xi',
            recordId: 'clustering:output:xi',
            direct: true,
          },
          {
            reference: 'catalog',
            recordId: 'root:input:catalog',
            label: 'Input catalogue',
            direct: false,
          },
        ],
        decisions: [
          {
            reference: 'method',
            recordId: 'root:decision:method',
            selection: 'Fiducial',
            direct: true,
          },
          {
            reference: 'weighting',
            recordId: 'clustering:decision:weighting',
            label: 'Weighting',
            scopeId: 'clustering',
            selection: 'FKP',
            direct: false,
          },
        ],
      },
    },
    {
      id: 'clustering:input:headline_alias',
      localId: 'headline_alias',
      canonicalPath: 'clustering.inputs.headline_alias',
      scopeId: 'clustering',
      kind: 'input',
      relations: [
        {
          kind: 'aliases',
          targetRecordId: 'root:output:headline',
          direct: true,
        },
      ],
    },
    {
      id: 'clustering:decision:method_alias',
      localId: 'method_alias',
      canonicalPath: 'clustering.decisions.method_alias',
      scopeId: 'clustering',
      kind: 'decision',
      relations: [
        {
          kind: 'aliases',
          targetRecordId: 'root:decision:method',
          direct: true,
        },
      ],
      options: [],
    },
    {
      id: 'clustering:decision:weighting',
      localId: 'weighting',
      canonicalPath: 'clustering.decisions.weighting',
      scopeId: 'clustering',
      kind: 'decision',
      label: 'Weighting',
      relations: [],
      selectedOptionId: 'fkp',
      options: [{ id: 'fkp', label: 'FKP', selected: true }],
    },
    {
      id: 'clustering:output:xi',
      localId: 'xi',
      canonicalPath: 'clustering.outputs.xi',
      scopeId: 'clustering',
      kind: 'output',
      relations: [
        {
          kind: 'depends_on',
          targetRecordId: 'root:input:catalog',
          direct: true,
        },
        {
          kind: 'parameterized_by',
          targetRecordId: 'clustering:decision:weighting',
          direct: true,
        },
        {
          kind: 'aliases',
          targetRecordId: 'root:output:headline',
          direct: true,
        },
      ],
      outputType: 'table',
      resourceIds: [],
      provenance: {
        inputs: [
          {
            reference: 'catalog',
            recordId: 'root:input:catalog',
            direct: true,
          },
        ],
        decisions: [
          {
            reference: 'weighting',
            recordId: 'clustering:decision:weighting',
            direct: true,
          },
        ],
      },
    },
  ],
  resources: [
    {
      id: 'resource:headline',
      kind: 'figure',
      fileName: 'headline.png',
      mediaType: 'image/png',
      revision: 'image-1',
      availability: 'available',
      source: 'inferred',
      outputRecordId: 'root:output:headline',
    },
  ],
  diagnostics: [],
};

export function fixtureModel(options = {}) {
  const model = structuredClone(canonicalFixture);
  if (options.analysisRevision) {
    model.revision.analysis = options.analysisRevision;
  }
  if (options.selectionRevision) {
    model.revision.selection = options.selectionRevision;
  }
  if (options.universeId) {
    model.selection.universeId = options.universeId;
    model.selection.source = 'explicit';
  }
  return model;
}

test('the canonical model fixture indexes and validates as one viewable model', () => {
  const model = fixtureModel({
    analysisRevision: 'analysis-1',
    selectionRevision: 'selection-1',
    universeId: 'baseline',
  });
  const index = createProjectViewModelIndex(model);

  assert.equal(model.scopes[0].id, 'root');
  assert.equal(model.scopes[1].parentId, 'root');
  assert.equal(model.revision.analysis, 'analysis-1');
  assert.equal(model.resources[0].id, 'resource:headline');
  assert.equal(model.resources[0].mediaType, 'image/png');

  const headline = index.recordByPath.get('outputs.headline').record;
  assert.deepEqual(
    headline.relations.map(({ kind, targetRecordId, direct }) => [
      kind,
      targetRecordId,
      direct,
    ]),
    [
      ['depends_on', 'clustering:output:xi', true],
      ['depends_on', 'root:input:catalog', false],
      ['parameterized_by', 'root:decision:method', true],
      ['parameterized_by', 'clustering:decision:weighting', false],
    ],
  );
  const alias = index.recordByPath.get('clustering.decisions.method_alias').record;
  assert.equal(alias.relations[0].targetRecordId, 'root:decision:method');
  const inputAlias = index.recordByPath.get('clustering.inputs.headline_alias').record;
  assert.equal(inputAlias.relations[0].targetRecordId, 'root:output:headline');

  const method = index.recordByPath.get('decisions.method').record;
  assert.deepEqual(method.options[0].insightRecordIds, ['root:prior_insight:published_method']);
  assert.deepEqual(validateProjectViewModel(model), []);
});

test('indexes authored local ids without deriving them from canonical paths', () => {
  const model = fixtureModel();
  const insight = model.records.find(
    (record) => record.kind === 'prior_insight',
  );
  insight.localId = 'planck2018_headline_parameters';
  insight.canonicalPath = 'prior_insights.host_normalized_slug';

  const index = createProjectViewModelIndex(model);
  assert.equal(
    index.recordsByLocalId.get('planck2018_headline_parameters')?.[0].record,
    insight,
  );
  assert.equal(index.recordsByLocalId.has('host_normalized_slug'), false);
});
