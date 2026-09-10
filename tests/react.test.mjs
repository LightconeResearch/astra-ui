import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailDialog, DialogProvider, PreviewPopover, Prose } from '../packages/react/dist/primitives/index.js';
import { renderProse } from '../packages/react/dist/lib/index.js';
import {
  ArtifactPreview,
  OutputDetail,
  PaperDetail,
  PaperDialog,
  RecordDialog,
  RecordPreview,
} from '../packages/react/dist/components/index.js';
import { recordEntry } from '../packages/react/dist/lib/index.js';
import { indexAnalysis } from '@astra-spec/sdk';
import { collectInventoryPapers } from '../packages/react/dist/model/index.js';
import { AnalysisTree, OutputCard, OutputsList } from '../packages/react/dist/blocks/index.js';
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

test('record previews render on the server while closed popovers keep portal DOM out of hydration', () => {
  const index = indexAnalysis(fixtureDocument);
  const output = index.recordByPath.get('outputs.headline');
  const content = React.createElement(RecordPreview, {
    entry: { kind: 'record', record: output, analysis: fixtureDocument.analysis },
    document: fixtureDocument,
    index,
    renderArtifact: () => React.createElement('span', null, 'Static artifact'),
  });
  const preview = withinUi(content);
  assert.match(preview, /data-slot="record-preview"/);
  assert.match(preview, /Headline result/);
  assert.match(preview, /Static artifact/);

  const popover = renderToStaticMarkup(React.createElement(PreviewPopover, {
    label: 'SSR output preview',
    trigger: React.createElement('button', { type: 'button' }, 'Result'),
    children: content,
  }));
  assert.match(popover, /<button[^>]*>Result<\/button>/);
  assert.doesNotMatch(popover, /preview-popover-portal|role="dialog"/);
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

test('authored prose accepts host-normalized custom math macros', () => {
  const html = withinUi(renderProse(
    'Configured value: $\\latevalue$.',
    { macros: { '\\latevalue': '42' } },
  ));

  assert.match(html, /<mn>42<\/mn>/);
  assert.doesNotMatch(html, /katex-error|mathcolor="#cc0000"/);
});

test('paper dialogs render on the server without initializing PDF.js', () => {
  const index = indexAnalysis(fixtureDocument);
  const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis, {
    '10.1234/example': { title: 'A useful paper', pdfUrl: '/paper.pdf' },
  })[0];
  let loads = 0;
  const html = withinUi(React.createElement(PaperDialog, {
    record: paper,
    loadPdfJs: async () => { loads++; throw new Error('Browser only'); },
    onClose: () => {},
  }));
  assert.equal(loads, 0);
  assert.match(html, /Loading PDF/);
  assert.match(html, /Locate/);
  assert.match(html, /href="\/paper.pdf"/);
  const withoutRuntime = withinUi(React.createElement(PaperDialog, { record: paper, onClose: () => {} }));
  assert.doesNotMatch(withoutRuntime, /astra-paper-pdf/);
  assert.match(withoutRuntime, /Embedded PDF viewing is unavailable/);
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
  // Without a hosted copy the header action falls back to the DOI.
  assert.match(html, /class="astra-dialog__action"[^>]*href="https:\/\/doi\.org\/10\.1234\/example"|href="https:\/\/doi\.org\/10\.1234\/example"[^>]*class="astra-dialog__action"/);

  const unfetchable = withinUi(React.createElement(PaperDialog, { record: paper, onClose: () => {} }));
  assert.match(unfetchable, /Follow the <a href="https:\/\/doi\.org\/10\.1234\/example"[^>]*>DOI<\/a> for the published version\./);

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

test('output dialogs list every decision on a dependency path in one list, including those of a sub-analysis', () => {
  const index = indexAnalysis(fixtureDocument);
  const figure = index.recordByPath.get('outputs.headline');
  const method = index.recordByPath.get('decisions.method');
  const clustering = fixtureDocument.analysis.analyses[0];
  const weighting = { ...method, id: 'weighting', label: 'Weighting scheme', canonicalPath: 'clustering.decisions.weighting' };
  const relations = {
    inputs: [],
    decisions: [
      { canonicalPath: method.canonicalPath, record: method, analysis: fixtureDocument.analysis },
      { canonicalPath: weighting.canonicalPath, record: weighting, analysis: clustering },
    ],
  };
  const html = withinUi(React.createElement(OutputDetail, { record: figure, relations }));
  assert.equal(html.match(/Decision dependencies/g).length, 1, 'a single decisions list');
  assert.doesNotMatch(html, /Indirect/);
  assert.match(html, /Method choice[\s\S]*Weighting scheme/);
  // Titles stand alone: no canonical-path subtitle under resolved records.
  assert.doesNotMatch(html, /decisions\.method/);
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

test('an insight opened from another analysis still offers its source passage', () => {
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
  assert.match(html, /<blockquote>The fiducial method performs well\.<\/blockquote>/);
  // The DOI pill is gone: the passage and its locate action carry the source.
  assert.doesNotMatch(html, /Source paper/);
});

test('an insight whose host cannot open papers links its source on doi.org', () => {
  const index = indexAnalysis(fixtureDocument);
  const html = withinUi(React.createElement(RecordDialog, {
    entry: recordEntry('prior_insights.published_method', '$'),
    document: fixtureDocument,
    index,
    papers: [],
    onClose: () => undefined,
  }));
  assert.match(html, /<blockquote>The fiducial method performs well\.<\/blockquote>/);
  assert.match(html, /<figcaption><a class="astra-insight-detail__open-source" href="https:\/\/doi\.org\/10\.1234\/example"/);
  assert.doesNotMatch(html, /Locate passage in paper/);
});

test('metric previews round numbers, keep strings verbatim, and drop a blank uncertainty', () => {
  const index = indexAnalysis(fixtureDocument);
  const output = index.recordByPath.get('outputs.headline');
  const rounded = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'metric', value: 1.012345678, uncertainty: 0.024567891 }, locale: 'en-US' }));
  assert.match(rounded, /1\.0123<\/strong>/);
  assert.match(rounded, /± 0\.024568</);
  const verbatim = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'metric', value: '5.00', uncertainty: '0.010' } }));
  assert.match(verbatim, />5\.00<\/strong>/);
  assert.match(verbatim, /± 0\.010</);
  const blank = withinUi(React.createElement(ArtifactPreview, { output, preview: { kind: 'metric', value: 5, uncertainty: '' } }));
  assert.doesNotMatch(blank, /±|Value unavailable/);
});

test('metric tiles carry an accessible name and consult the host renderer like the gallery', () => {
  const headline = fixtureDocument.analysis.outputs[0];
  const metric = { ...headline, id: 'neff', canonicalPath: 'outputs.neff', label: 'Effective sample size', type: 'metric', format: 'json', artifact: undefined };
  const analysis = { ...fixtureDocument.analysis, outputs: [metric] };
  const rendered = [];
  const html = withinUi(React.createElement(OutputsList, {
    analysis,
    renderArtifact: (output) => { rendered.push(output.canonicalPath); return React.createElement('span', null, 'Host preview'); },
    onOpenRecord: () => undefined,
  }));
  assert.match(html, /<button[^>]*aria-label="Open metric: Effective sample size"/);
  assert.deepEqual(rendered, ['outputs.neff']);
  assert.match(html, /Host preview/);
  const hostless = withinUi(React.createElement(OutputsList, { analysis, onOpenRecord: () => undefined }));
  assert.match(hostless, /Not yet generated/);
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
