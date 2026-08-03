import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  InventoryExplorer,
  OverviewInventory,
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
