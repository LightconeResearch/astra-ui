import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailDialog, DialogProvider, Prose } from '../packages/react/dist/primitives/index.js';
import {
  ArtifactPreview,
  OutputDetail,
  PaperDetail,
  PaperDialog,
  RecordDialog,
  recordEntry,
} from '../packages/react/dist/components/index.js';
import { indexAnalysis } from '@astra-spec/sdk';
import { collectInventoryPapers } from '../packages/react/dist/model/index.js';
import { AnalysisTree, OutputCard } from '../packages/react/dist/blocks/index.js';
import { Inventory } from '../packages/react/dist/views/index.js';
import { fixtureDocument } from './fixture.mjs';

function withinUi(component) {
  return renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' }, component),
  );
}

test('the composed inventory consumes ResolvedAnalysisDocument directly', () => {
  const renderedOutputs = [];
  const html = withinUi(React.createElement(Inventory, {
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
  const html = withinUi(React.createElement(Inventory, {
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

test('authored prose typesets inline code and LaTeX by default, and is host-renderable by slot', () => {
  const plain = withinUi(React.createElement(Prose, { text: 'Plain **text** stays as written.' }));
  assert.match(plain, /Plain \*\*text\*\* stays as written\./);
  assert.doesNotMatch(plain, /katex|<strong>|<code>/);

  const rich = withinUi(React.createElement(Prose, {
    text: 'Peak at $s^2\\,\\Delta\\xi_\\ell(s)$ with `qiso`. $$\\alpha_\\mathrm{iso} = 1$$',
  }));
  assert.match(rich, /astra-prose__inline-math/);
  assert.match(rich, /astra-prose__display-math/);
  assert.match(rich, /class="katex"/);
  assert.match(rich, /class="katex-display"/);
  assert.match(rich, /katex-mathml/);
  assert.match(rich, /<code>qiso<\/code>/);

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
  const index = indexAnalysis(fixtureDocument);
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

test('the artifact box frames figures and tables, or whatever the host returns, and nothing otherwise', () => {
  const index = indexAnalysis(fixtureDocument);
  const figure = index.recordByPath.get('outputs.headline');
  const data = { ...figure, id: 'raw', canonicalPath: 'outputs.raw', type: 'data', format: 'npy' };
  const relations = { inputs: [], decisions: [] };
  const box = /astra-output-detail__artifact/;
  assert.match(withinUi(React.createElement(OutputDetail, { record: figure, relations })), box);
  assert.doesNotMatch(withinUi(React.createElement(OutputDetail, { record: data, relations })), box);
  assert.doesNotMatch(withinUi(React.createElement(OutputDetail, { record: data, relations, renderArtifact: () => null })), box);
  const hosted = withinUi(React.createElement(OutputDetail, { record: data, relations, renderArtifact: () => React.createElement('span', null, 'host preview') }));
  assert.match(hosted, box);
  assert.match(hosted, /host preview/);
});

test('a figure whose host renderer opts out falls back to the single-column layout', () => {
  const index = indexAnalysis(fixtureDocument);
  const figure = index.recordByPath.get('outputs.headline');
  const relations = { inputs: [], decisions: [] };
  assert.match(withinUi(React.createElement(OutputDetail, { record: figure, relations })), /data-layout="reader"/);
  const optedOut = withinUi(React.createElement(OutputDetail, { record: figure, relations, renderArtifact: () => null }));
  assert.match(optedOut, /data-layout="single"/);
  assert.doesNotMatch(optedOut, /astra-output-detail__artifact/);
  assert.doesNotMatch(optedOut, /astra-output-detail__provenance-slot/);
});

test('output dialogs list indirect decision dependencies reached through upstream outputs', () => {
  const index = indexAnalysis(fixtureDocument);
  const figure = index.recordByPath.get('outputs.headline');
  const method = index.recordByPath.get('decisions.method');
  const relations = { inputs: [], decisions: [], indirectDecisions: [{ canonicalPath: method.canonicalPath, record: method, analysis: fixtureDocument.analysis }] };
  const html = withinUi(React.createElement(OutputDetail, { record: figure, relations }));
  assert.match(html, /Indirect decision dependencies/);
  assert.match(html, /Through upstream outputs\./);
  assert.match(html, /Method choice/);
});

test('output cards carry an accessible name instead of their preview cells', () => {
  const index = indexAnalysis(fixtureDocument);
  const html = withinUi(React.createElement(OutputCard, { output: index.recordByPath.get('outputs.headline'), onOpen: () => undefined }));
  assert.match(html, /<button[^>]*aria-label="Open figure: Headline result"/);
});

test('a paper fetch error is announced', () => {
  const index = indexAnalysis(fixtureDocument);
  const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis)[0];
  const html = withinUi(React.createElement(PaperDetail, { record: paper, metadata: { status: 'error', error: 'Not in cache' }, onFetchPaper: () => undefined }));
  assert.match(html, /<p role="alert">Not in cache<\/p>/);
});

test('an insight opened from another analysis still offers its source paper', () => {
  const index = indexAnalysis(fixtureDocument);
  const clustering = fixtureDocument.analysis.analyses[0];
  const papersOfClustering = collectInventoryPapers(fixtureDocument, index, clustering);
  assert.equal(papersOfClustering.some(({ doi }) => doi === '10.1234/example'), false, 'the viewed analysis does not list the paper');
  const html = withinUi(React.createElement(RecordDialog, {
    entry: recordEntry('prior_insights.published_method', '$'),
    document: fixtureDocument,
    index,
    papers: papersOfClustering,
    onOpenPaper: () => undefined,
    onClose: () => undefined,
  }));
  assert.match(html, /Locate passage in paper/);
  assert.match(html, /<button type="button">https:\/\/doi\.org\/10\.1234\/EXAMPLE/);
});

test('table previews say whether their total is exact or unknown, and stay quiet when compact', () => {
  const index = indexAnalysis(fixtureDocument);
  const output = index.recordByPath.get('outputs.headline');
  const rows = [['1', '2'], ['3', '4']];
  const exact = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'table', headers: ['a', 'b'], rows, totalRows: 5 } }));
  assert.match(exact, /Showing 2 of 5 rows and 2 of 2 columns\./);
  const unknown = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'table', headers: ['a', 'b'], rows, truncated: true } }));
  assert.match(unknown, /Showing the first 2 rows \(total unknown\) and 2 of 2 columns\./);
  assert.doesNotMatch(unknown, /2 of 2 rows/);
  const complete = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'table', headers: ['a', 'b'], rows } }));
  assert.doesNotMatch(complete, /Showing/);
  const compact = withinUi(React.createElement(ArtifactPreview, { output, compact: true, preview: { kind: 'table', headers: ['a', 'b'], rows, truncated: true } }));
  assert.doesNotMatch(compact, /Showing/);
});
