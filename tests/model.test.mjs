import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptLegacyInventorySnapshot,
  createAstraGraphProjection,
  createAstraGraphViewProjection,
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

test('graph projection derives provenance, decisions, evidence, and a display result', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    universeId: 'baseline',
  });
  const graph = createAstraGraphProjection(model, {
    outputGroupThreshold: 99,
  });

  const catalog = graph.nodes.find((node) => node.canonicalPath === 'inputs.catalog');
  const clustering = graph.nodes.find(
    (node) => node.kind === 'analysis' && node.scopeId === 'clustering',
  );
  const xi = graph.nodes.find((node) => node.canonicalPath === 'clustering.outputs.xi');
  const headline = graph.nodes.find((node) => node.canonicalPath === 'outputs.headline');
  const result = graph.nodes.find((node) => node.kind === 'result');
  const publishedInsight = graph.nodes.find(
    (node) => node.canonicalPath === 'prior_insights.published_method',
  );

  assert.ok(catalog);
  assert.ok(clustering);
  assert.ok(xi);
  assert.ok(headline);
  assert.ok(result?.synthetic);
  assert.ok(publishedInsight);
  assert.ok(graph.edges.some(
    (edge) => edge.source === catalog.id && edge.target === clustering.id,
  ));
  assert.ok(graph.edges.some(
    (edge) => edge.source === xi.id && edge.kind === 'flow',
  ));
  assert.ok(graph.edges.some(
    (edge) => edge.target === headline.id && edge.kind === 'produces',
  ));
  assert.ok(graph.edges.some((edge) => edge.kind === 'informs'));
  assert.ok(graph.edges.some(
    (edge) => edge.target === result.id && edge.kind === 'concludes',
  ));
});

test('graph projection groups repeated records mechanically without graph metadata', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[0].records.push(
    {
      id: 'chain_a',
      path: 'outputs.chain_a',
      kind: 'output',
      type: 'dataset',
      decisions: ['method'],
      recipe: { command: 'python scripts/fit.py --sample a' },
    },
    {
      id: 'chain_b',
      path: 'outputs.chain_b',
      kind: 'output',
      type: 'dataset',
      recipe: { command: 'python scripts/fit.py --sample b' },
    },
    {
      id: 'chain_c',
      path: 'outputs.chain_c',
      kind: 'output',
      type: 'dataset',
      decisions: ['method'],
      recipe: { command: 'python scripts/fit.py --sample c' },
    },
  );
  const model = adaptLegacyInventorySnapshot(fixture);
  const graph = createAstraGraphProjection(model);
  const group = graph.nodes.find((node) => node.label === 'Chain ×3');

  assert.equal(group?.kind, 'output-group');
  assert.deepEqual(group?.memberPaths, [
    'outputs.chain_a',
    'outputs.chain_b',
    'outputs.chain_c',
  ]);
});

test('curated graph views retain supported provenance and omit invented arrows', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    universeId: 'baseline',
  });
  const semantic = createAstraGraphProjection(model, {
    outputGroupThreshold: 99,
  });
  const view = createAstraGraphViewProjection(semantic, {
    version: 1,
    nodes: [
      {
        id: 'catalog',
        kind: 'input',
        select: { canonicalPaths: ['inputs.catalog'] },
      },
      {
        id: 'headline',
        kind: 'output',
        select: { canonicalPaths: ['outputs.headline'] },
      },
      {
        id: 'result',
        kind: 'result',
        select: { nodeIds: ['result:project'] },
      },
    ],
    edges: [
      { source: 'catalog', target: 'headline' },
      { source: 'result', target: 'catalog' },
    ],
    decisionGroups: [{
      id: 'method',
      target: 'headline',
      members: ['decisions.method'],
    }],
  });

  assert.ok(view.edges.some(
    (edge) => edge.source === 'view:catalog' && edge.target === 'view:headline',
  ));
  assert.equal(view.edges.some(
    (edge) => edge.source === 'view:result' && edge.target === 'view:catalog',
  ), false);
  assert.ok(view.diagnostics.some(
    (diagnostic) => diagnostic.code === 'graph_view_unsupported_edge',
  ));
  assert.ok(view.nodes.some((node) => node.id === 'view:decision-cluster:method'));
});
