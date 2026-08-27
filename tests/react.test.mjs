import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { indexAnalysis } from '@astra-spec/sdk';
import {
  ArtifactPreview,
  InventoryDetailDialog,
  InventoryDetailPresentation,
  InventoryExplorer,
  InventoryProse,
  OverviewInventory,
  PaperDialog,
  collectInventoryPapers,
} from '../packages/react/dist/index.js';
import { fixtureDocument } from './fixture.mjs';

function withinUi(component) {
  return renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' }, component),
  );
}

test('the composed inventory consumes ResolvedAnalysisDocument directly', () => {
  const renderedOutputs = [];
  const html = withinUi(React.createElement(InventoryExplorer, {
    document: fixtureDocument,
    paperMetadata: {
      '10.1234/example': { title: 'A useful paper' },
    },
    renderArtifact: (output, { compact }) => {
      renderedOutputs.push([output.canonicalPath, compact]);
      return React.createElement('span', { 'data-preview': output.canonicalPath }, 'Host preview');
    },
  }));

  assert.match(html, /heading-text">Outputs/);
  assert.match(html, /heading-text">Decisions/);
  assert.match(html, /heading-text">Inputs/);
  assert.match(html, /heading-text">Findings/);
  assert.match(html, /heading-text">Prior Insights/);
  assert.match(html, /heading-text">Papers/);
  assert.match(html, /Headline result/);
  assert.match(html, /Fiducial/);
  assert.match(html, /A useful paper/);
  assert.match(html, /2 evidence items/);
  assert.match(html, /Host preview/);
  assert.deepEqual(renderedOutputs, [['outputs.headline', true]]);
  assert.doesNotMatch(html, /results\//);
});

test('the analysis picker follows the SDK recursive analysis tree', () => {
  const html = withinUi(React.createElement(OverviewInventory, {
    document: fixtureDocument,
    analysisPath: 'clustering',
    onSelectAnalysis: () => {},
  }));

  assert.match(html, /Project hierarchy/);
  assert.match(html, /DESI demo/);
  assert.match(html, /Clustering/);
  assert.match(html, /aria-current="page"/);
});

test('artifact previews render only host-safe values', () => {
  const output = fixtureDocument.analysis.outputs[0];
  const html = withinUi(React.createElement(ArtifactPreview, {
    output,
    caption: 'Preview supplied by host',
    preview: {
      kind: 'table',
      headers: ['tracer', 'alpha'],
      rows: [['LRG', 1.002]],
    },
  }));

  assert.match(html, /tracer/);
  assert.match(html, /1\.002/);
  assert.doesNotMatch(html, /results\//);

  const inactive = withinUi(React.createElement(ArtifactPreview, {
    output: fixtureDocument.analysis.outputs[1],
  }));
  assert.match(inactive, /not active in the selected universe/);
});

test('authored prose is plain by default and host-renderable by slot', () => {
  const plain = withinUi(React.createElement(InventoryProse, {
    text: 'Use $x$ and **strong** literally.',
  }));
  assert.match(plain, /Use \$x\$ and \*\*strong\*\* literally\./);
  assert.doesNotMatch(plain, /katex|<strong>/);

  const custom = withinUi(React.createElement(InventoryProse, {
    text: 'Host prose',
    renderText: (text) => React.createElement('em', null, text),
  }));
  assert.match(custom, /<em>Host prose<\/em>/);
});

test('paper content and source focus are delegated to a host renderer', () => {
  const index = indexAnalysis(fixtureDocument);
  const paper = collectInventoryPapers(
    fixtureDocument,
    index,
    fixtureDocument.analysis,
    {
      '10.1234/example': {
        title: 'A useful paper',
        pdfUrl: '/papers/example.pdf',
      },
    },
  )[0];
  let renderOptions;
  const html = withinUi(React.createElement(PaperDialog, {
    paper,
    analysis: fixtureDocument.analysis,
    initialFocusInsight: paper.insights[0],
    renderPaper: (_paper, options) => {
      renderOptions = options;
      return React.createElement('div', { 'data-paper-renderer': true }, 'Host paper renderer');
    },
    onOpenInsight: () => {},
    onOpenDecision: () => {},
    onClose: () => {},
  }));

  assert.match(html, /Host paper renderer/);
  assert.match(html, /Locate/);
  assert.equal(
    renderOptions.focusEvidence.evidence.quote.exact,
    'The fiducial method performs well.',
  );
});

test('missing paper content exposes only a host fetch event', () => {
  const paper = {
    doi: '10.1234/example',
    title: 'A useful paper',
    insights: [],
    decisions: [],
  };
  const html = withinUi(React.createElement(PaperDialog, {
    paper,
    analysis: fixtureDocument.analysis,
    onFetchPaper: () => {},
    onOpenInsight: () => {},
    onOpenDecision: () => {},
    onClose: () => {},
  }));

  assert.match(html, /Fetch paper/);
  assert.doesNotMatch(html, /Loading|Fetching|pdf\.mjs/);
});

test('detail presentation preserves accessible modal and embedded shells', () => {
  const detail = React.createElement(InventoryDetailDialog, {
    kind: 'decision',
    eyebrow: 'Decision · Analysis',
    title: 'Method choice',
    closeLabel: 'Close decision details',
    onClose: () => {},
    children: React.createElement('p', null, 'Decision content'),
  });
  const modal = withinUi(detail);
  assert.match(modal, /<dialog/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-label="Close decision details"/);

  const embedded = withinUi(React.createElement(InventoryDetailPresentation, {
    mode: 'embedded',
    children: detail,
  }));
  assert.match(embedded, /inventory-detail-dialog--embedded/);
  assert.doesNotMatch(embedded, /<dialog/);
});
