import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptLegacyInventorySnapshot,
  buildGraphOrganizerBrief,
  buildProjectGraph,
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
          recipe: {
            command: 'python scripts/render_headline.py --output {output}',
          },
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
          from: '../headline',
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

test('parent graph projects each child scope once and exposes canonical boundary outputs', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-graph-1',
  });
  const graph = buildProjectGraph(model);
  const clusteringOutput = model.records.find(
    (record) => record.canonicalPath === 'clustering.outputs.xi',
  );
  assert.ok(clusteringOutput);

  assert.equal(graph.organizationStatus, 'missing');
  assert.equal(graph.focusScopeId, 'root');
  assert.equal(graph.nodes.length, 6);
  assert.deepEqual(
    graph.nodes
      .filter((node) => node.nodeType === 'record')
      .map((node) => node.recordId)
      .sort(),
    [
      ...model.records
        .filter((record) => record.scopeId === 'root')
        .map((record) => record.id),
      clusteringOutput.id,
    ].sort(),
  );
  assert.equal(
    graph.nodes.some((node) =>
      node.nodeType === 'scope'
      && node.targetScopeId === 'clustering'
      && node.recordCount === 4
    ),
    true,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === `record:${clusteringOutput.id}`
      && edge.targetNodeId === 'record:root:output:headline'
      && edge.relationKinds.includes('depends_on')
    ),
    true,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'record:root:input:catalog'
      && edge.targetNodeId === 'record:root:output:headline'
      && edge.relationKinds.includes('depends_on')
    ),
    false,
  );
  assert.equal(
    graph.nodes.some((node) =>
      node.nodeType === 'record'
      && node.recordId === clusteringOutput.id
      && node.scopeId === 'clustering'
    ),
    true,
  );
  assert.equal(
    graph.nodes.some((node) =>
      node.nodeType === 'record'
      && node.scopeId === 'clustering'
      && node.kind !== 'output'
    ),
    false,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'scope:clustering'
      && edge.targetNodeId === `record:${clusteringOutput.id}`
      && edge.relationKinds.includes('contains')
    ),
    true,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === `record:${clusteringOutput.id}`
      && edge.targetNodeId === 'scope:clustering'
    ),
    false,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'record:root:output:headline'
      && edge.targetNodeId === 'scope:clustering'
      && edge.relationKinds.includes('aliases')
      && edge.projectionRole === 'subanalysis_input'
    ),
    true,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'record:root:decision:method'
      && edge.targetNodeId === 'record:root:output:headline'
      && edge.relationKinds.includes('parameterized_by')
    ),
    true,
  );
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'scope:clustering'
      && edge.targetNodeId === 'record:root:output:headline'
      && edge.relationKinds.includes('parameterized_by')
    ),
    false,
  );
  assert.deepEqual(
    graph.scopes.map(({ id, parentId, depth }) => [id, parentId, depth]),
    [
      ['root', undefined, 0],
      ['clustering', 'root', 1],
    ],
  );

  const childGraph = buildProjectGraph(model, undefined, { focusScopeId: 'clustering' });
  assert.equal(childGraph.focusScopeId, 'clustering');
  assert.equal(childGraph.nodes.length, 4);
  assert.equal(childGraph.nodes.every((node) => node.scopeId === 'clustering'), true);
  assert.deepEqual(
    childGraph.scopes.map(({ id, parentId, depth }) => [id, parentId, depth]),
    [['clustering', undefined, 0]],
  );
});

test('organization contracts valid peers without authoring graph edges', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[1].records.push({
    id: 'xi_alt',
    path: 'clustering.outputs.xi_alt',
    kind: 'output',
    type: 'table',
    inputs: ['catalog'],
    decisions: ['weighting'],
  });
  const model = adaptLegacyInventorySnapshot(fixture, {
    analysisRevision: 'analysis-graph-2',
  });
  const organization = {
    schema_version: 'graph-organization.v1',
    source: {
      entrypoint: 'astra.yaml',
      organization_input_digest: 'analysis-graph-2',
    },
    groups: [{
      id: 'clustering_correlations',
      label: 'Clustering correlations',
      scope: 'clustering',
      kind: 'output',
      members: ['xi', 'xi_alt'],
    }],
  };
  const graph = buildProjectGraph(model, organization, { focusScopeId: 'clustering' });

  assert.equal(graph.organizationStatus, 'current');
  assert.equal(graph.validGroups.length, 1);
  assert.equal(graph.nodes.some((node) => node.id === 'group:clustering_correlations'), true);
  assert.equal(graph.nodes.some((node) => node.id === 'record:clustering:output:xi'), false);
  assert.equal(graph.nodes.length, 4);
  assert.equal(
    graph.edges.some((edge) =>
      edge.sourceNodeId === 'record:clustering:decision:weighting'
      && edge.targetNodeId === 'group:clustering_correlations'
    ),
    true,
  );

  const complete = buildProjectGraph(model, organization, {
    useOrganization: false,
    focusScopeId: 'clustering',
  });
  assert.equal(complete.nodes.length, 5);
});

test('decision groups stay mechanically expanded for the decision list', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-decisions-list',
  });
  const organization = {
    schema_version: 'graph-organization.v1',
    source: {
      entrypoint: 'astra.yaml',
      organization_input_digest: 'analysis-decisions-list',
    },
    groups: [{
      id: 'clustering_controls',
      label: 'Clustering controls',
      scope: 'clustering',
      kind: 'decision',
      members: ['method_alias', 'weighting'],
    }],
  };
  const graph = buildProjectGraph(model, organization, { focusScopeId: 'clustering' });

  assert.equal(graph.organizationStatus, 'current');
  assert.equal(graph.validGroups.length, 1);
  assert.equal(graph.nodes.some((node) => node.id === 'group:clustering_controls'), false);
  assert.equal(graph.nodes.some((node) => node.id === 'record:clustering:decision:method_alias'), true);
  assert.equal(graph.nodes.some((node) => node.id === 'record:clustering:decision:weighting'), true);
});

test('stale and invalid groups degrade without making records disappear', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-current',
  });
  const organization = {
    schema_version: 'graph-organization.v1',
    source: {
      entrypoint: 'astra.yaml',
      organization_input_digest: 'analysis-old',
    },
    groups: [
      {
        id: 'valid_controls',
        label: 'Valid controls',
        scope: 'clustering',
        kind: 'decision',
        members: ['method_alias', 'weighting'],
      },
      {
        id: 'missing_outputs',
        label: 'Missing outputs',
        scope: 'root',
        kind: 'output',
        members: ['headline', 'no_longer_exists'],
      },
    ],
  };
  const graph = buildProjectGraph(model, organization);

  assert.equal(graph.organizationStatus, 'stale_partly_invalid');
  assert.deepEqual(graph.validGroups.map((group) => group.id), ['valid_controls']);
  assert.equal(graph.nodes.some((node) => node.id === 'record:root:output:headline'), true);
  assert.equal(
    graph.diagnostics.some((diagnostic) => diagnostic.code === 'graph_group_member'),
    true,
  );
});

test('graph organizer brief is self-contained and stamped to the analysis', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-brief-1',
  });
  const brief = buildGraphOrganizerBrief(model, {
    entrypoint: 'projects/DESI run/astra.yaml',
    organizationPath: 'projects/DESI run/astra.graph.yaml',
  });

  assert.match(brief, /organization_input_digest: analysis-brief-1/);
  assert.match(brief, /entrypoint: "projects\/DESI run\/astra\.yaml"/);
  assert.match(brief, /Do not edit `projects\/DESI run\/astra\.yaml`/);
  assert.match(brief, /wait for explicit approval/);
  assert.match(brief, /recipe family: scripts\/render_headline\.py/);
  assert.match(brief, /Repeated applications across tracers, bins, or parameterizations/);
  assert.match(brief, /Do not group decisions/);
  assert.match(brief, /mechanically omits prior insights and findings/i);
  assert.match(brief, /tracer-specific decision target or option/i);
  assert.match(brief, /projects each real ASTRA sub-analysis as one expandable node/);
  assert.match(brief, /clustering\.outputs\.xi/);
  assert.doesNotMatch(brief, /\n(?:dependencies|edges):/);
});
