import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptLegacyInventorySnapshot,
  createProjectViewModelIndex,
  validateProjectViewModel,
} from '../packages/model/dist/index.js';

export const legacyFixture = {
  version: 1,
  analysis: {
    id: 'desi-demo',
    name: 'DESI demo',
    description: 'A small nested ASTRA viewer fixture.',
  },
  scopes: [
    {
      id: '',
      path: '',
      name: 'DESI demo',
      children: ['clustering'],
      records: [
        {
          id: 'catalog',
          path: 'inputs.catalog',
          kind: 'input',
          type: 'data',
          description: 'Input catalogue.',
        },
        {
          id: 'method',
          path: 'decisions.method',
          kind: 'decision',
          selected: 'fiducial',
          options: { fiducial: 'Fiducial', alternate: 'Alternate' },
          option_insights: { fiducial: ['published_method'] },
        },
        {
          id: 'published_method',
          path: 'prior_insights.published_method',
          kind: 'prior_insight',
          claim: 'The method is established.',
          evidence: [{ doi: '10.0000/example' }],
        },
        {
          id: 'headline',
          path: 'outputs.headline',
          kind: 'output',
          type: 'figure',
          inputs: ['clustering.xi'],
          inputs_root: [{ id: 'catalog', label: 'Input catalogue' }],
          decisions: ['method'],
          decisions_transitive: [
            { id: 'method', selection: 'Fiducial' },
            {
              id: 'weighting',
              label: 'Weighting',
              selection: 'FKP',
              via: 'clustering',
            },
          ],
          resolved_path: 'results/baseline/headline.png',
          resourceIds: ['resource:headline'],
          mediaType: 'image/png',
          resourceRevision: 'image-1',
        },
      ],
    },
    {
      id: 'clustering',
      path: 'clustering',
      name: 'Clustering',
      parent: '',
      children: [],
      records: [
        {
          id: 'headline_alias',
          path: 'clustering.inputs.headline_alias',
          kind: 'input',
          from: '../headline',
        },
        {
          id: 'method_alias',
          path: 'clustering.decisions.method_alias',
          kind: 'decision',
          from: '../method',
          options: {},
        },
        {
          id: 'weighting',
          path: 'clustering.decisions.weighting',
          kind: 'decision',
          label: 'Weighting',
          selected: 'fkp',
          options: { fkp: 'FKP' },
        },
        {
          id: 'xi',
          path: 'clustering.outputs.xi',
          kind: 'output',
          type: 'table',
          inputs: ['catalog'],
          decisions: ['weighting'],
        },
      ],
    },
  ],
  diagnostics: [],
};

test('legacy ASTRA snapshots adapt to one canonical, viewable model', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
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
  assert.equal(
    headline.relations.some(
      (relation) => relation.kind === 'depends_on' && relation.direct === false,
    ),
    true,
  );
  const alias = index.recordByPath.get('clustering.decisions.method_alias').record;
  assert.equal(alias.relations[0].targetRecordId, 'root:decision:method');
  const inputAlias = index.recordByPath.get('clustering.inputs.headline_alias').record;
  assert.equal(inputAlias.relations[0].targetRecordId, 'root:output:headline');

  const method = index.recordByPath.get('decisions.method').record;
  assert.deepEqual(method.options[0].insightRecordIds, ['root:prior_insight:published_method']);
  assert.deepEqual(validateProjectViewModel(model), []);
});

test('unresolved legacy relations are viewing diagnostics, not dangling edges', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[0].records.at(-1).inputs = ['missing_output'];
  const model = adaptLegacyInventorySnapshot(fixture);
  const headline = model.records.find((record) => record.canonicalPath === 'outputs.headline');

  assert.equal(headline.relations.some((relation) => relation.targetRecordId === 'missing_output'), false);
  assert.equal(
    model.diagnostics.some((diagnostic) => diagnostic.code === 'legacy_unresolved_relation'),
    true,
  );
});

test('indexes authored local ids without deriving them from canonical paths', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture);
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
