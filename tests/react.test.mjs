import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  DetailDialog,
  DialogProvider,
  PaperDialog,
  Prose,
  RecordDialog,
  collectInventoryPapers,
  createInventoryIndex,
  recordEntry,
} from '../packages/react/dist/components.js';
import { AnalysisTree, InventoryExplorer } from '../packages/react/dist/views.js';
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

  for (const label of ['Outputs', 'Decisions', 'Inputs', 'Findings', 'Prior Insights', 'Papers']) {
    assert.match(html, new RegExp(`<h2 id="[a-z-]+" tabindex="-1"><span>${label}</span></h2>`));
  }
  assert.match(html, /Headline result/);
  assert.match(html, /Fiducial/);
  assert.match(html, /A useful paper/);
  assert.match(html, /2 evidence items/);
  assert.match(html, /Host preview/);
  assert.deepEqual(renderedOutputs, [['outputs.headline', true]]);
  assert.doesNotMatch(html, /results\//);
  assert.match(html, /class="astra-inventory"/);
  assert.doesNotMatch(html, /class="inventory-/);
});

test('sections, labels, and anchors are configurable', () => {
  const html = withinUi(React.createElement(InventoryExplorer, {
    document: fixtureDocument,
    sections: ['findings', 'outputs'],
    idPrefix: 'demo-',
    showOutline: false,
    labels: { sections: { outputs: 'Results' } },
  }));
  assert.match(html, /<h2 id="demo-findings"/);
  assert.match(html, /<h2 id="demo-outputs" tabindex="-1"><span>Results<\/span>/);
  assert.doesNotMatch(html, /Decisions/);
  assert.doesNotMatch(html, /On this page/);
});

test('the analysis picker follows the SDK recursive analysis tree', () => {
  const html = withinUi(React.createElement(AnalysisTree, {
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
  assert.match(html, /data-type="table"/);
  assert.doesNotMatch(html, /results\//);

  const inactive = withinUi(React.createElement(ArtifactPreview, {
    output: fixtureDocument.analysis.outputs[1],
  }));
  assert.match(inactive, /not active in the selected universe/);

  const loading = withinUi(React.createElement(ArtifactPreview, {
    output,
    preview: { kind: 'loading' },
  }));
  assert.match(loading, /aria-busy="true"/);
});

test('authored prose is plain by default and host-renderable by slot', () => {
  const plain = withinUi(React.createElement(Prose, {
    text: 'Use $x$ and **strong** literally.',
  }));
  assert.match(plain, /Use \$x\$ and \*\*strong\*\* literally\./);
  assert.doesNotMatch(plain, /katex|<strong>/);

  let seenField;
  const custom = withinUi(React.createElement(Prose, {
    text: 'Host prose',
    field: 'rationale',
    renderText: (text, { field }) => { seenField = field; return React.createElement('em', null, text); },
  }));
  assert.match(custom, /<em>Host prose<\/em>/);
  assert.equal(seenField, 'rationale');
});

test('paper content and source focus are delegated to a host renderer', () => {
  const index = createInventoryIndex(fixtureDocument);
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
    record: paper,
    focusInsight: paper.insights[0],
    renderPaper: (_paper, options) => {
      renderOptions = options;
      return React.createElement('div', { 'data-paper-renderer': true }, 'Host paper renderer');
    },
    onClose: () => {},
  }));

  assert.match(html, /Host paper renderer/);
  assert.match(html, /Locate/);
  assert.match(html, /class="astra-dialog__action"/);
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
    record: paper,
    onFetchPaper: () => {},
    onClose: () => {},
  }));

  assert.match(html, /Fetch paper/);
  assert.doesNotMatch(html, /Loading|Fetching|pdf\.mjs/);

  const fetching = withinUi(React.createElement(PaperDialog, {
    record: paper,
    metadata: { status: 'fetching' },
    onFetchPaper: () => {},
    onClose: () => {},
  }));
  assert.match(fetching, /aria-busy="true"/);
  assert.match(fetching, /<button type="button" disabled=""/);
});

test('detail presentation preserves accessible modal and embedded shells', () => {
  const detail = React.createElement(DetailDialog, {
    kind: 'decision',
    kindLabel: 'Decision',
    title: 'Method choice',
    closeLabel: 'Close decision details',
    onClose: () => {},
    children: React.createElement('p', null, 'Decision content'),
  });
  const modal = withinUi(detail);
  assert.match(modal, /<dialog/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-label="Close decision details"/);
  assert.match(modal, /class="astra-dialog__panel" data-kind="decision"/);

  const embedded = withinUi(React.createElement(DialogProvider, {
    mode: 'embedded',
    children: detail,
  }));
  assert.match(embedded, /data-mode="embedded"[^>]*class="astra-dialog"/);
  assert.doesNotMatch(embedded, /<dialog/);
});

test('the record dialog derives relations and evidence from the index', () => {
  const index = createInventoryIndex(fixtureDocument);
  const output = withinUi(React.createElement(RecordDialog, {
    entry: recordEntry('outputs.headline', '$'),
    document: fixtureDocument,
    index,
    onClose: () => {},
  }));
  assert.match(output, /Headline result/);
  assert.match(output, /Input catalogue/);
  assert.match(output, /Method choice/);

  const finding = withinUi(React.createElement(RecordDialog, {
    entry: recordEntry('findings.headline_finding', '$'),
    document: fixtureDocument,
    index,
    onOpenRecord: () => {},
    onClose: () => {},
  }));
  assert.match(finding, /Supporting results/);
  assert.match(finding, /View supporting result: Headline result/);

  const missing = withinUi(React.createElement(RecordDialog, {
    entry: recordEntry('outputs.gone', '$'),
    document: fixtureDocument,
    index,
    onClose: () => {},
    fallback: React.createElement('p', null, 'gone'),
  }));
  assert.match(missing, /<dialog[^>]*data-kind="analysis"/);
  assert.match(missing, /no longer available/);
  assert.match(missing, /<p>gone<\/p>/);
});
