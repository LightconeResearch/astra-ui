import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  InventoryExplorer,
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
