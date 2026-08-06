import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  adaptLegacyInventorySnapshot,
  createInventoryModel,
  InsightDetailDialog,
  InventoryExplorer,
  InventoryRelationList,
  OverviewInventory,
  PaperDialog,
} from '../packages/react/dist/index.js';
import { legacyFixture } from './model.test.mjs';

test('inventory preserves the full standalone sections without a host dependency', () => {
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-viewer' },
      React.createElement(InventoryExplorer, {
        snapshot: legacyFixture,
        scopeId: '',
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
  const model = adaptLegacyInventorySnapshot(legacyFixture, {
    universeId: 'baseline',
  });
  const inventory = createInventoryModel(model);
  const headline = inventory.recordByPath.get('outputs.headline')?.record;
  assert.deepEqual(headline?.inputs, ['clustering.outputs.xi']);
  assert.deepEqual(headline?.inputs_root, [{
    id: 'inputs.catalog',
    label: 'Input catalogue',
  }]);
  assert.deepEqual(
    headline?.decisions_transitive?.map(({ id, via }) => [id, via]),
    [
      ['decisions.method', 'root'],
      ['clustering.decisions.weighting', 'clustering'],
    ],
  );
  assert.equal(
    inventory.recordByPath.get('clustering.outputs.xi')?.record.from,
    'outputs.headline',
  );
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-viewer' },
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
  const html = renderToStaticMarkup(
    React.createElement(OverviewInventory, {
      snapshot: legacyFixture,
      scopeId: '',
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

test('paper details use compact insight and informed-decision lists', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperDialog, {
      paper: {
        doi: '10.0000/example',
        title: 'Example paper',
        insights: [{
          id: 'a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          path: 'prior_insights.a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          kind: 'prior_insight',
          claim: 'A compact claim preview.',
          doi: '10.0000/example',
          quote: 'A source passage.',
        }],
        decisions: [{
          id: 'method',
          path: 'decisions.method',
          kind: 'decision',
          label: 'Method choice',
        }],
      },
      scope: { id: 'root', path: '', name: 'Example', children: [], records: [] },
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
  const model = createInventoryModel(legacyFixture);
  const scope = model.snapshot.scopes[0];
  const insight = scope.records.find((record) => record.kind === 'prior_insight');
  assert.ok(insight);

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
