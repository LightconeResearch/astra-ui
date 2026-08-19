import assert from 'node:assert/strict';
import test from 'node:test';
import { createInventoryModel } from '../packages/react/dist/index.js';
import {
  deriveProjectGraph,
  graphRecordNodeId,
  graphScopeNodeId,
  layoutProjectGraph,
} from '../packages/react/dist/views.js';
import { fixtureModel } from './model.test.mjs';

test('derives record nodes and collapsed child-analysis nodes for a nested scope', () => {
  const model = fixtureModel();
  // The projector emits informed_by relations for decision evidence; the
  // shared fixture leaves them off, so add one to exercise that edge too.
  model.records
    .find((record) => record.id === 'root:decision:method')
    .relations.push({
      kind: 'informed_by',
      targetRecordId: 'root:prior_insight:published_method',
      direct: true,
    });
  const graph = deriveProjectGraph(createInventoryModel(model));

  assert.equal(graph.scope.id, 'root');
  assert.deepEqual(
    graph.nodes.map((node) => [node.id, node.nodeType, node.kind]),
    [
      ['record:root:input:catalog', 'record', 'input'],
      ['record:root:decision:method', 'record', 'decision'],
      ['record:root:prior_insight:published_method', 'record', 'prior_insight'],
      ['record:root:output:headline', 'record', 'output'],
      ['scope:clustering', 'scope', 'analysis'],
    ],
  );

  const scopeNode = graph.nodes.find((node) => node.nodeType === 'scope');
  assert.equal(scopeNode.label, 'Clustering');
  assert.equal(scopeNode.recordCount, 4);

  // Edges come only from direct typed relations; records inside the child
  // analysis collapse onto its scope node.
  assert.deepEqual(
    graph.edges.map(({ sourceId, targetId, relationKinds }) => [
      sourceId,
      targetId,
      relationKinds,
    ]),
    [
      // method parameterizes headline directly.
      ['record:root:decision:method', 'record:root:output:headline', ['parameterized_by']],
      // clustering's method_alias aliases the root decision.
      ['record:root:decision:method', 'scope:clustering', ['aliases']],
      // catalog feeds clustering.xi (collapsed to the scope node).
      ['record:root:input:catalog', 'scope:clustering', ['depends_on']],
      // headline is aliased inside clustering (input alias and xi's alias).
      ['record:root:output:headline', 'scope:clustering', ['aliases']],
      // the insight informs the method decision.
      ['record:root:prior_insight:published_method', 'record:root:decision:method', ['informed_by']],
      // clustering.xi feeds headline.
      ['scope:clustering', 'record:root:output:headline', ['depends_on']],
    ],
  );

  // Indirect (transitive) provenance never draws an edge.
  assert.ok(!graph.edges.some(({ sourceId, targetId }) => (
    sourceId === graphRecordNodeId('root:input:catalog')
    && targetId === graphRecordNodeId('root:output:headline')
  )));
});

test('a sub-analysis scope projects only its own records', () => {
  const graph = deriveProjectGraph(createInventoryModel(fixtureModel()), {
    scopeId: 'clustering',
  });
  assert.equal(graph.scope.id, 'clustering');
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    [
      'record:clustering:input:headline_alias',
      'record:clustering:decision:method_alias',
      'record:clustering:decision:weighting',
      'record:clustering:output:xi',
    ],
  );
  // Relations to records outside this scope resolve to no node here, so they
  // make no edge; the in-scope parameterization remains.
  assert.deepEqual(
    graph.edges.map(({ sourceId, targetId }) => [sourceId, targetId]),
    [[
      graphRecordNodeId('clustering:decision:weighting'),
      graphRecordNodeId('clustering:output:xi'),
    ]],
  );
});

test('unresolved references never produce dangling edges', () => {
  const model = fixtureModel();
  const headline = model.records.find((record) => record.id === 'root:output:headline');
  headline.relations.push(
    { kind: 'depends_on', targetRecordId: 'root:input:does_not_exist', direct: true },
    { kind: 'parameterized_by', targetRecordId: '', direct: true },
  );
  const graph = deriveProjectGraph(createInventoryModel(model));
  const baseline = deriveProjectGraph(createInventoryModel(fixtureModel()));

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    assert.ok(nodeIds.has(edge.sourceId), `dangling source ${edge.sourceId}`);
    assert.ok(nodeIds.has(edge.targetId), `dangling target ${edge.targetId}`);
  }
  assert.deepEqual(graph.edges, baseline.edges);
});

test('the layered layout is deterministic and layers sources above products', () => {
  const first = layoutProjectGraph(deriveProjectGraph(createInventoryModel(fixtureModel())));
  const second = layoutProjectGraph(deriveProjectGraph(createInventoryModel(fixtureModel())));

  assert.deepEqual([...first.positions.entries()], [...second.positions.entries()]);
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);

  const at = (id) => first.positions.get(id);
  for (const [id, position] of first.positions) {
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y), id);
  }
  // catalog (input) sits above the collapsed clustering scope, which sits
  // above the headline output it feeds.
  assert.ok(at(graphRecordNodeId('root:input:catalog')).y < at(graphScopeNodeId('clustering')).y);
  assert.ok(at(graphScopeNodeId('clustering')).y < at(graphRecordNodeId('root:output:headline')).y);
  // Nodes sharing a layer never overlap horizontally.
  const byY = new Map();
  for (const [id, position] of first.positions) {
    const layer = byY.get(position.y) ?? [];
    layer.push([id, position.x]);
    byY.set(position.y, layer);
  }
  for (const layer of byY.values()) {
    const xs = layer.map(([, x]) => x).sort((left, right) => left - right);
    for (let i = 1; i < xs.length; i += 1) {
      assert.ok(xs[i] - xs[i - 1] >= 216, 'layer neighbors keep a full node width apart');
    }
  }
});
