import assert from 'node:assert/strict';
import test from 'node:test';
import {
  astraGraphOutputGroupNodeId,
  astraGraphVisualStageNodeId,
  adaptLegacyInventorySnapshot,
  createAstraGraphOrganizationDigest,
  createAstraGraphOrganizationProjection,
  createAstraGraphOrganizationSource,
  createAstraGraphOrganizationTopology,
  createAstraGraphProjection,
  createAstraGraphViewProjection,
  createProjectViewModelIndex,
  parseAstraGraphOrganization,
  validateAstraGraphOrganization,
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
  const method = graph.nodes.find(
    (node) => node.kind === 'decision' && node.canonicalPath === 'decisions.method',
  );
  assert.ok(method?.meta.includes('affects 1 output'));
  assert.equal(method?.meta.some((item) => item.includes('visible output node')), false);
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

test('lossless graph projection never applies heuristic record grouping or compaction', () => {
  const fixture = structuredClone(legacyFixture);
  for (const id of ['chain_a', 'chain_b', 'chain_c']) {
    fixture.scopes[0].records.push({
      id,
      path: `outputs.${id}`,
      kind: 'output',
      type: 'dataset',
      recipe: { command: `python scripts/fit.py --sample ${id}` },
    });
  }
  const model = adaptLegacyInventorySnapshot(fixture);
  const graph = createAstraGraphProjection(model, {
    mode: 'lossless',
    maxOutputNodes: 4,
  });

  assert.equal(graph.nodes.some((node) => node.kind === 'output-group'), false);
  assert.deepEqual(
    graph.nodes
      .filter((node) => node.kind === 'output' && node.canonicalPath?.includes('chain_'))
      .map((node) => node.canonicalPath)
      .sort(),
    ['outputs.chain_a', 'outputs.chain_b', 'outputs.chain_c'],
  );

  const catalog = graph.nodes.find((node) => node.canonicalPath === 'inputs.catalog');
  const xi = graph.nodes.find((node) => node.canonicalPath === 'clustering.outputs.xi');
  const headline = graph.nodes.find((node) => node.canonicalPath === 'outputs.headline');
  assert.ok(catalog && xi && headline);
  assert.ok(graph.edges.some(
    (edge) => edge.source === catalog.id && edge.target === xi.id && edge.kind === 'flow',
  ));
  assert.ok(graph.edges.some(
    (edge) => edge.source === xi.id && edge.target === headline.id && edge.kind === 'flow',
  ));
  assert.equal(graph.edges.some(
    (edge) => edge.source === xi.id && edge.target.startsWith('analysis:'),
  ), false);
  assert.equal(graph.edges.some(
    (edge) => edge.target === xi.id && edge.source.startsWith('analysis:'),
  ), false);
});

test('graph organization topology is sanitized and digest ignores result resources', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-1',
  });
  const topology = createAstraGraphOrganizationTopology(model);
  const headline = topology.outputs.find((output) => output.canonicalPath === 'outputs.headline');

  assert.equal(topology.source.analysisRevision, 'analysis-1');
  assert.equal(topology.source.organizationDigest, 'fnv1a64:01c6da4272f163d7');
  assert.deepEqual(headline?.dependencies, ['clustering.outputs.xi']);
  assert.deepEqual(headline?.decisions, [
    'clustering.decisions.weighting',
    'decisions.method',
  ]);
  assert.equal(JSON.stringify(topology).includes('resolved_path'), false);
  assert.equal(JSON.stringify(topology).includes('scripts/'), false);

  const changedResults = structuredClone(model);
  changedResults.resources[0].revision = 'new-result-bytes';
  const headlineRecord = changedResults.records.find(
    (record) => record.canonicalPath === 'outputs.headline',
  );
  headlineRecord.metric = { value: 42 };
  assert.equal(
    createAstraGraphOrganizationDigest(changedResults),
    createAstraGraphOrganizationDigest(model),
  );
});

test('restricted graph organization collapses stages and groups without changing semantic DAG', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[1].records = fixture.scopes[1].records.filter(
    (record) => record.id !== 'headline_alias',
  );
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
  );
  const model = adaptLegacyInventorySnapshot(fixture, {
    analysisRevision: 'analysis-1',
  });
  const source = createAstraGraphOrganizationSource(model);
  const organization = {
    version: 1,
    source,
    stages: [{
      id: 'inference',
      label: 'Inference products',
      scopeId: 'root',
      outputs: ['outputs.headline'],
      groups: [{
        id: 'chains',
        label: 'MCMC chains',
        outputs: ['outputs.chain_a', 'outputs.chain_b'],
      }],
    }],
  };
  const validation = validateAstraGraphOrganization(model, organization);
  assert.equal(validation.valid, true);
  assert.equal(validation.sourceStatus, 'current');
  assert.deepEqual(validation.unassignedOutputPaths, ['clustering.outputs.xi']);

  const raw = createAstraGraphProjection(model, { mode: 'lossless' });
  const stageId = astraGraphVisualStageNodeId('root', 'inference');
  const groupId = astraGraphOutputGroupNodeId('root', 'inference', 'chains');
  const collapsed = createAstraGraphOrganizationProjection(raw, organization);
  const stage = collapsed.nodes.find((node) => node.id === stageId);
  assert.equal(stage?.kind, 'visual-stage');
  assert.equal(stage?.synthetic, true);
  assert.deepEqual(stage?.memberPaths, [
    'outputs.headline',
    'outputs.chain_a',
    'outputs.chain_b',
  ]);
  assert.ok(collapsed.nodes.some(
    (node) => node.kind === 'analysis' && node.scopeId === 'root',
  ));
  assert.ok(collapsed.nodes.some(
    (node) => node.canonicalPath === 'clustering.outputs.xi',
  ));
  assert.ok(collapsed.edges.some(
    (edge) => edge.target === stageId
      && edge.kind === 'configures'
      && edge.label === 'affects 2/3'
      && edge.semanticEdgeIds?.length === 2,
  ));

  const stageExpanded = createAstraGraphOrganizationProjection(raw, organization, {
    expandedNodeIds: [stageId],
  });
  assert.equal(stageExpanded.nodes.some((node) => node.id === stageId), false);
  assert.equal(stageExpanded.nodes.find((node) => node.id === groupId)?.kind, 'output-group');
  assert.ok(stageExpanded.nodes.some((node) => node.canonicalPath === 'outputs.headline'));
  assert.equal(stageExpanded.nodes.some((node) => node.canonicalPath === 'outputs.chain_a'), false);
  assert.ok(stageExpanded.edges.some(
    (edge) => edge.target === groupId
      && edge.kind === 'configures'
      && edge.label === 'affects 1/2',
  ));

  const fullyExpanded = createAstraGraphOrganizationProjection(raw, organization, {
    expandedNodeIds: [stageId, groupId],
  });
  assert.equal(fullyExpanded.nodes.some((node) => node.id === groupId), false);
  assert.ok(fullyExpanded.nodes.some((node) => node.canonicalPath === 'outputs.chain_a'));
  assert.equal(
    fullyExpanded.edges.some((edge) => edge.semanticEdgeIds?.length === 0),
    false,
  );
});

test('graph organization rejects cross-scope and repeated assignments without hiding outputs', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture);
  const raw = createAstraGraphProjection(model, { mode: 'lossless' });
  const organization = {
    version: 1,
    source: createAstraGraphOrganizationSource(model),
    stages: [{
      id: 'bad',
      label: 'Bad stage',
      scopeId: 'root',
      outputs: ['outputs.headline', 'outputs.headline'],
      groups: [{
        id: 'cross_scope',
        label: 'Cross scope',
        outputs: ['outputs.headline', 'clustering.outputs.xi'],
      }],
    }],
  };
  const validation = validateAstraGraphOrganization(model, organization);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.some(
    (item) => item.code === 'graph_organization_cross_scope',
  ));
  assert.ok(validation.diagnostics.some(
    (item) => item.code === 'graph_organization_duplicate_output',
  ));

  const projected = createAstraGraphOrganizationProjection(raw, organization);
  assert.ok(projected.nodes.some((node) => node.canonicalPath === 'outputs.headline'));
  assert.ok(projected.nodes.some((node) => node.canonicalPath === 'clustering.outputs.xi'));
  assert.equal(projected.nodes.some((node) => node.kind === 'visual-stage'), false);
});

test('organization staleness distinguishes revision-only and topology changes', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    analysisRevision: 'analysis-1',
  });
  const organization = {
    version: 1,
    source: createAstraGraphOrganizationSource(model),
    stages: [{
      id: 'headline',
      label: 'Headline',
      scopeId: 'root',
      outputs: ['outputs.headline'],
    }],
  };
  const revisionOnly = structuredClone(model);
  revisionOnly.revision.analysis = 'analysis-2';
  assert.equal(
    validateAstraGraphOrganization(revisionOnly, organization).sourceStatus,
    'compatible',
  );

  const topologyChanged = structuredClone(revisionOnly);
  const headline = topologyChanged.records.find(
    (record) => record.canonicalPath === 'outputs.headline',
  );
  headline.description = 'Changed curator-visible meaning.';
  assert.equal(
    validateAstraGraphOrganization(topologyChanged, organization).sourceStatus,
    'outdated',
  );
});

test('graph organization parser rejects extra capabilities and hostile JSON safely', () => {
  const valid = {
    version: 1,
    source: {
      analysisRevision: ' analysis-1 ',
      organizationDigest: ' fnv1a64:0000000000000000 ',
    },
    stages: [{
      id: ' inference_stage ',
      label: ' Inference products ',
      scopeId: ' root ',
      rationale: ' A visual grouping only. ',
      outputs: [' outputs.headline '],
      groups: [{
        id: 'chains',
        label: ' Chains ',
        outputs: [' outputs.chain_a ', 'outputs.chain_b'],
      }],
    }],
  };
  const parsed = parseAstraGraphOrganization(valid);
  assert.equal(parsed.diagnostics.length, 0);
  assert.deepEqual(parsed.organization?.stages[0], {
    id: 'inference_stage',
    label: 'Inference products',
    scopeId: 'root',
    rationale: 'A visual grouping only.',
    outputs: ['outputs.headline'],
    groups: [{
      id: 'chains',
      label: 'Chains',
      outputs: ['outputs.chain_a', 'outputs.chain_b'],
    }],
  });

  const noStages = structuredClone(valid);
  noStages.stages = [];
  assert.ok(parseAstraGraphOrganization(noStages).diagnostics.some(
    (item) => item.code === 'graph_organization_empty_stages',
  ));

  const inventedEdge = structuredClone(valid);
  inventedEdge.edges = [{ source: 'a', target: 'b' }];
  assert.equal(parseAstraGraphOrganization(inventedEdge).organization, undefined);
  assert.ok(parseAstraGraphOrganization(inventedEdge).diagnostics.some(
    (item) => item.code === 'graph_organization_unknown_key',
  ));

  const invalidId = structuredClone(valid);
  invalidId.stages[0].id = 'a/b';
  assert.ok(parseAstraGraphOrganization(invalidId).diagnostics.some(
    (item) => item.code === 'graph_organization_invalid_id',
  ));

  const oversized = structuredClone(valid);
  oversized.stages[0].rationale = 'x'.repeat(300_000);
  assert.ok(parseAstraGraphOrganization(oversized).diagnostics.some(
    (item) => item.code === 'graph_organization_size_limit',
  ));

  const cyclic = { version: 1 };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => parseAstraGraphOrganization(cyclic));
  assert.equal(parseAstraGraphOrganization(cyclic).organization, undefined);
});

test('lossless cross-scope dependencies do not create a synthetic raw cycle', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture);
  const organization = {
    version: 1,
    source: createAstraGraphOrganizationSource(model),
    stages: [{
      id: 'headline',
      label: 'Headline products',
      scopeId: 'root',
      outputs: ['outputs.headline'],
    }],
  };
  const validation = validateAstraGraphOrganization(model, organization);
  assert.equal(validation.valid, true);
  assert.equal(validation.diagnostics.some(
    (item) => item.code === 'graph_organization_raw_cycle',
  ), false);

  const raw = createAstraGraphProjection(model, { mode: 'lossless' });
  const projected = createAstraGraphOrganizationProjection(raw, organization);
  assert.equal(projected.nodes.some((node) => node.kind === 'visual-stage'), true);
  assert.equal(projected.nodes.some(
    (node) => node.canonicalPath === 'outputs.headline',
  ), false);
  assert.ok(projected.nodes.some(
    (node) => node.canonicalPath === 'clustering.outputs.xi',
  ));
});

test('visual stages cannot create quotient cycles and output groups must be peer antichains', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[1].records = fixture.scopes[1].records.filter(
    (record) => record.id !== 'headline_alias',
  );
  fixture.scopes[0].records.push(
    { id: 'step_a', path: 'outputs.step_a', kind: 'output', type: 'dataset' },
    {
      id: 'step_b',
      path: 'outputs.step_b',
      kind: 'output',
      type: 'dataset',
      inputs: ['step_a'],
    },
    {
      id: 'step_c',
      path: 'outputs.step_c',
      kind: 'output',
      type: 'dataset',
      inputs: ['step_b'],
    },
  );
  const model = adaptLegacyInventorySnapshot(fixture);
  const source = createAstraGraphOrganizationSource(model);
  const cyclicStage = {
    version: 1,
    source,
    stages: [{
      id: 'non_contiguous',
      label: 'Non-contiguous stage',
      scopeId: 'root',
      outputs: ['outputs.step_a', 'outputs.step_c'],
    }],
  };
  const stageValidation = validateAstraGraphOrganization(model, cyclicStage);
  assert.equal(stageValidation.valid, false);
  assert.ok(stageValidation.diagnostics.some(
    (item) => item.code === 'graph_organization_stage_cycle',
  ));

  const nonPeers = {
    version: 1,
    source,
    stages: [{
      id: 'steps',
      label: 'Steps',
      scopeId: 'root',
      groups: [{
        id: 'not_peers',
        label: 'Not peers',
        outputs: ['outputs.step_a', 'outputs.step_b'],
      }],
    }],
  };
  const peerValidation = validateAstraGraphOrganization(model, nonPeers);
  assert.equal(peerValidation.valid, false);
  assert.ok(peerValidation.diagnostics.some(
    (item) => item.code === 'graph_organization_non_peer_group',
  ));
});

test('curator topology allowlists project and resolved relation fields', () => {
  const model = adaptLegacyInventorySnapshot(legacyFixture);
  model.project.internalSecret = 'do not serialize';
  const headline = model.records.find(
    (record) => record.canonicalPath === 'outputs.headline',
  );
  headline.recipe = { command: 'python scripts/private.py --token secret' };
  headline.privateField = 'also do not serialize';
  headline.relations.push({
    kind: 'depends_on',
    targetRecordId: 'unresolved-secret-relation',
  });

  const topology = createAstraGraphOrganizationTopology(model);
  const serialized = JSON.stringify(topology);
  const topologyHeadline = topology.outputs.find(
    (output) => output.canonicalPath === 'outputs.headline',
  );
  assert.equal(serialized.includes('do not serialize'), false);
  assert.equal(serialized.includes('also do not serialize'), false);
  assert.equal(serialized.includes('private.py'), false);
  assert.equal(serialized.includes('unresolved-secret-relation'), false);
  assert.equal(topologyHeadline?.recipeClass, 'recipe-1');

  const reordered = structuredClone(model);
  reordered.records.reverse();
  reordered.scopes.reverse();
  assert.equal(
    createAstraGraphOrganizationDigest(reordered),
    createAstraGraphOrganizationDigest(model),
  );
});

test('organization graph node ids use injective component encoding', () => {
  assert.notEqual(
    astraGraphVisualStageNodeId('scope/a', 'stage'),
    astraGraphVisualStageNodeId('scope_2Fa', 'stage'),
  );
  assert.notEqual(
    astraGraphOutputGroupNodeId('root', 'stage/a', 'group'),
    astraGraphOutputGroupNodeId('root', 'stage_2Fa', 'group'),
  );
  assert.doesNotThrow(() => astraGraphVisualStageNodeId('\ud800', 'stage'));
  assert.notEqual(
    astraGraphVisualStageNodeId('\ud800', 'stage'),
    astraGraphVisualStageNodeId('\udc00', 'stage'),
  );
});

test('organization ids are local to their scope and containing stage', () => {
  const fixture = structuredClone(legacyFixture);
  fixture.scopes[1].records = fixture.scopes[1].records.filter(
    (record) => record.id !== 'headline_alias',
  );
  fixture.scopes[0].records.push(
    { id: 'root_a', path: 'outputs.root_a', kind: 'output', type: 'dataset' },
    { id: 'root_b', path: 'outputs.root_b', kind: 'output', type: 'dataset' },
    { id: 'root_c', path: 'outputs.root_c', kind: 'output', type: 'dataset' },
    { id: 'root_d', path: 'outputs.root_d', kind: 'output', type: 'dataset' },
  );
  fixture.scopes[1].records.push(
    {
      id: 'nested_a',
      path: 'clustering.outputs.nested_a',
      kind: 'output',
      type: 'dataset',
    },
    {
      id: 'nested_b',
      path: 'clustering.outputs.nested_b',
      kind: 'output',
      type: 'dataset',
    },
  );
  const model = adaptLegacyInventorySnapshot(fixture);
  const organization = {
    version: 1,
    source: createAstraGraphOrganizationSource(model),
    stages: [
      {
        id: 'products',
        label: 'Root products',
        scopeId: 'root',
        groups: [{
          id: 'peers',
          label: 'Root peers',
          outputs: ['outputs.root_a', 'outputs.root_b'],
        }],
      },
      {
        id: 'products',
        label: 'Nested products',
        scopeId: 'clustering',
        groups: [{
          id: 'peers',
          label: 'Nested peers',
          outputs: [
            'clustering.outputs.nested_a',
            'clustering.outputs.nested_b',
          ],
        }],
      },
      {
        id: 'secondary',
        label: 'Secondary root products',
        scopeId: 'root',
        groups: [{
          id: 'peers',
          label: 'Other root peers',
          outputs: ['outputs.root_c', 'outputs.root_d'],
        }],
      },
    ],
  };
  const validation = validateAstraGraphOrganization(model, organization);
  assert.equal(validation.valid, true);

  const raw = createAstraGraphProjection(model, { mode: 'lossless' });
  const projected = createAstraGraphOrganizationProjection(raw, organization);
  assert.ok(projected.nodes.some(
    (node) => node.id === astraGraphVisualStageNodeId('root', 'products'),
  ));
  assert.ok(projected.nodes.some(
    (node) => node.id === astraGraphVisualStageNodeId('clustering', 'products'),
  ));
  const expanded = createAstraGraphOrganizationProjection(raw, organization, {
    expandedNodeIds: [
      astraGraphVisualStageNodeId('root', 'products'),
      astraGraphVisualStageNodeId('clustering', 'products'),
      astraGraphVisualStageNodeId('root', 'secondary'),
    ],
  });
  const groupIds = [
    astraGraphOutputGroupNodeId('root', 'products', 'peers'),
    astraGraphOutputGroupNodeId('clustering', 'products', 'peers'),
    astraGraphOutputGroupNodeId('root', 'secondary', 'peers'),
  ];
  assert.equal(new Set(groupIds).size, 3);
  assert.ok(groupIds.every((id) => expanded.nodes.some((node) => node.id === id)));
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
