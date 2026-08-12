import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  createInventoryModel,
  GraphExplorer,
  InsightDetailDialog,
  InventoryDetailDialog,
  InventoryExplorer,
  InventoryRelationList,
  OverviewInventory,
  PaperDialog,
} from '../packages/react/dist/index.js';
import { fixtureModel } from './model.test.mjs';

test('inventory renders the canonical model without a host dependency', () => {
  const model = fixtureModel();
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryExplorer, {
        model,
        scopeId: 'root',
      }),
    ),
  );

  assert.match(html, /1\. Outputs/);
  assert.match(html, /2\. Decisions/);
  assert.match(html, /3\. Inputs/);
  assert.match(html, /4\. Findings/);
  assert.match(html, /5\. Papers/);
  assert.match(html, /headline/);
  assert.match(html, /Fiducial/);
  assert.match(html, /10\.0000\/example/);
  assert.doesNotMatch(html, /jupyter|myst/i);
});

test('canonical models preserve the complete rich inventory presentation', () => {
  const model = fixtureModel({ universeId: 'baseline' });
  const inventory = createInventoryModel(model);
  const headline = inventory.recordByPath.get('outputs.headline')?.record;
  assert.equal(headline?.kind, 'output');
  assert.deepEqual(headline?.provenance.inputs, [
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
  ]);
  assert.deepEqual(
    headline?.provenance.decisions.map(({ recordId, scopeId }) => [recordId, scopeId]),
    [
      ['root:decision:method', undefined],
      ['clustering:decision:weighting', 'clustering'],
    ],
  );
  assert.equal(
    inventory.recordByPath.get('clustering.outputs.xi')?.record.relations
      .find((relation) => relation.kind === 'aliases')?.targetRecordId,
    'root:output:headline',
  );
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryExplorer, {
        model,
        scopeId: 'root',
      }),
    ),
  );

  assert.match(html, /1\. Outputs/);
  assert.match(html, /2\. Decisions/);
  assert.match(html, /3\. Inputs/);
  assert.match(html, /4\. Findings/);
  assert.match(html, /5\. Papers/);
  assert.match(html, /headline/);
  assert.match(html, /Fiducial/);
  assert.match(html, /10\.0000\/example/);
});

test('analysis hierarchy preserves the standalone recursive scope selector', () => {
  const model = fixtureModel();
  const html = renderToStaticMarkup(
    React.createElement(OverviewInventory, {
      model,
      scopeId: 'root',
      onSelectScope: () => {},
    }),
  );

  assert.match(html, /DESI demo/);
  assert.match(html, /Clustering/);
  assert.match(html, /Project hierarchy/);
});

test('artifact previews render host-safe data rather than paths', () => {
  const html = renderToStaticMarkup(
    React.createElement(ArtifactPreview, {
      preview: {
        kind: 'table',
        headers: ['tracer', 'alpha'],
        rows: [['LRG', 1.002]],
      },
    }),
  );
  assert.match(html, /tracer/);
  assert.match(html, /1\.002/);
  assert.doesNotMatch(html, /results\//);
});

test('shared detail headers preserve the inventory modal contract', () => {
  const html = renderToStaticMarkup(
    React.createElement(InventoryDetailDialog, {
      kind: 'decision',
      eyebrow: 'Decision · Root analysis',
      title: 'Method choice',
      identifier: 'decisions.method',
      closeLabel: 'Close decision details',
      onClose: () => {},
      children: React.createElement('p', null, 'Decision content'),
    }),
  );

  assert.match(html, /inventory-detail-dialog__header astra-surface-header|astra-surface-header inventory-detail-dialog__header/);
  assert.match(html, /data-density="regular"/);
  assert.match(html, /data-kind="decision"/);
  assert.match(html, /<dialog/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Close decision details"/);
  assert.match(html, /decisions\.method/);
  assert.match(html, /Decision content/);
});

test('paper details use compact insight and informed-decision lists', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperDialog, {
      paper: {
        doi: '10.0000/example',
        title: 'Example paper',
        insights: [{
          id: 'root:prior_insight:a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          localId: 'a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          canonicalPath: 'prior_insights.a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          scopeId: 'root',
          kind: 'prior_insight',
          relations: [],
          claim: 'A compact claim preview.',
          evidence: [{ doi: '10.0000/example', quote: 'A source passage.' }],
        }],
        decisions: [{
          id: 'root:decision:method',
          localId: 'method',
          canonicalPath: 'decisions.method',
          scopeId: 'root',
          kind: 'decision',
          label: 'Method choice',
          relations: [],
          options: [],
        }],
      },
      scope: {
        id: 'root',
        canonicalPath: 'root',
        name: 'Example',
        childIds: [],
        recordIds: [],
      },
      onOpenInsight: () => {},
      onOpenDecision: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /inventory-paper-insights/);
  assert.match(html, /inventory-paper-insight__claim/);
  assert.match(html, /Informs decisions/);
  assert.match(html, /inventory-paper-informs/);
  assert.doesNotMatch(html, />prior insight</);
  assert.doesNotMatch(html, /inventory-paper-insight__quote/);
});

test('relationship lists share compact typed rows instead of pill boxes', () => {
  const html = renderToStaticMarkup(
    React.createElement(InventoryRelationList, {
      title: 'Dependencies',
      items: [{
        key: 'method',
        label: 'Method choice',
        kind: 'decision',
        detail: 'Direct',
        onOpen: () => {},
      }],
      empty: 'No dependencies.',
    }),
  );

  assert.match(html, /inventory-relation-item__glyph/);
  assert.match(html, /data-kind="decision"/);
  assert.match(html, />◇</);
  assert.match(html, /Method choice/);
  assert.match(html, /Direct/);
});

test('insight details use the same compact informed-decision relationship', () => {
  const model = createInventoryModel(fixtureModel());
  const scope = model.model.scopes[0];
  const insight = model.recordById.get('root:prior_insight:published_method');
  assert.ok(insight);
  assert.equal(insight.kind, 'prior_insight');

  const html = renderToStaticMarkup(
    React.createElement(InsightDetailDialog, {
      insight,
      model,
      scope,
      onOpenDecision: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /Informs decisions/);
  assert.match(html, /data-kind="decision"/);
  assert.doesNotMatch(html, /decisions\.method/);
});

test('graph shows the structural ASTRA projection behind an explicit first-run choice', () => {
  const model = fixtureModel({ analysisRevision: 'analysis-graph-react' });
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(GraphExplorer, {
        model,
        onOrganize: () => {},
      }),
    ),
  );

  assert.match(html, /astra-project-view-header astra-graph__toolbar/);
  assert.match(html, /astra-project-view-header__title/);
  assert.match(html, /How would you like to begin/);
  assert.match(html, /Structural ASTRA graph/);
  assert.match(html, /Organize graph with AI/);
  assert.match(html, /View ungrouped graph/);
  assert.match(html, /DESI demo/);
  assert.match(html, /Clustering ASTRA sub-analysis; click to inspect/);
  assert.match(html, /xi: clustering\.outputs\.xi/);
  assert.match(html, />From Clustering<\/small>/);
  assert.doesNotMatch(html, />Sub-analysis · Clustering<\/small>/);
  assert.doesNotMatch(html, /astra-graph-node__detail[^>]*>Input<\/small>/);
  assert.match(html, /data-node-type="scope"/);
  assert.doesNotMatch(html, /visible nodes|canonical links/);
  assert.match(html, /headline/);
  assert.match(html, /Graph grammar/);
  assert.match(html, /aria-haspopup="true"/);
  assert.doesNotMatch(html, /astra-graph__legend-menu/);
  assert.match(html, /astra-graph__decision-panel/);
  assert.match(html, /data-open="false"/);
  assert.match(html, /aria-label="Expand decisions"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />1<\/strong>/);
  assert.match(html, /Interactive ASTRA graph canvas/);
  assert.match(html, /react-flow__controls/);
  assert.doesNotMatch(html, /astra-graph__decision-row/);
  assert.doesNotMatch(html, /react-flow__edge[^>]*astra-graph-edge--decision/);
  assert.doesNotMatch(html, /astra-graph__inspector/);
  assert.doesNotMatch(html, /data-kind="prior_insight"/);
  assert.doesNotMatch(html, /data-kind="finding"/);
  assert.doesNotMatch(html, /class="astra-graph-node"[^>]*data-kind="decision"/);
  assert.match(html, /react-flow__arrowhead/);
});

test('grouped records use a stacked kind icon without expanding the graph', () => {
  const model = fixtureModel({ analysisRevision: 'analysis-react-groups' });
  for (const localId of ['chart_a', 'chart_b']) {
    model.records.push({
      id: `root:output:${localId}`,
      localId,
      canonicalPath: `outputs.${localId}`,
      scopeId: 'root',
      kind: 'output',
      relations: [
        { kind: 'depends_on', targetRecordId: 'root:input:catalog', direct: true },
        { kind: 'parameterized_by', targetRecordId: 'root:decision:method', direct: true },
      ],
      outputType: 'figure',
      resourceIds: [],
      provenance: {
        inputs: [
          { reference: 'catalog', recordId: 'root:input:catalog', direct: true },
        ],
        decisions: [
          { reference: 'method', recordId: 'root:decision:method', direct: true },
        ],
      },
    });
    model.scopes[0].recordIds.push(`root:output:${localId}`);
  }
  const organization = {
    schema_version: 'graph-organization.v1',
    source: {
      entrypoint: 'astra.yaml',
      organization_input_digest: 'analysis-react-groups',
    },
    groups: [{
      id: 'headline_figures',
      label: 'Headline figures',
      scope: 'root',
      kind: 'output',
      members: ['chart_a', 'chart_b'],
    }],
  };
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(GraphExplorer, { model, organization }),
    ),
  );

  assert.match(html, /Headline figures: 2 grouped records/);
  assert.match(html, /astra-graph-node__group-mark/);
  assert.match(html, /astra-graph-node__mark--group-back/);
  assert.match(html, /astra-graph-node__mark--group-front/);
  assert.doesNotMatch(html, />2 output records<\/text>/);
  assert.doesNotMatch(html, /Group ·/);
  assert.doesNotMatch(html, /Collapse groups/);
});
