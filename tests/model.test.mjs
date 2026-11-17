import assert from 'node:assert/strict';
import test from 'node:test';
import { indexAnalysis } from '@astra-spec/sdk';
import { artifactPreviewFromSource, tablePreviewFromDelimited } from '../packages/react/dist/lib/index.js';
import {
  arxivIdFromDoi,
  arxivPaperMetadata,
  collectInventoryPapers,
  decisionInsights,
  findingEvidence,
  findingLiterature,
  outputDecisionPaths,
  outputDecisionRoutes,
  informedDecisions,
  locateRecord,
  outputRelations,
} from '../packages/react/dist/model/index.js';
import { fixtureDocument } from './fixture.mjs';

test('paper presentation data is derived from the SDK document and index', () => {
  const index = indexAnalysis(fixtureDocument);
  const papers = collectInventoryPapers(
    fixtureDocument,
    index,
    fixtureDocument.analysis,
    {
      '10.1234/example': {
        title: 'A useful paper',
        authors: 'A. Researcher',
        pdfUrl: '/papers/example.pdf',
      },
    },
  );

  assert.deepEqual(papers.map(({ doi }) => doi), [
    '10.1234/example',
    '10.5678/nested',
    '10.9999/finding',
  ]);
  assert.equal(papers[0].title, 'A useful paper');
  assert.deepEqual(
    papers[0].insights.map(({ canonicalPath }) => canonicalPath),
    ['prior_insights.published_method', 'prior_insights.uncited_caveat'],
  );
  assert.deepEqual(
    papers[0].decisions.map(({ canonicalPath }) => canonicalPath),
    ['decisions.method'],
  );
  assert.deepEqual(
    papers[2].insights.map(({ canonicalPath }) => canonicalPath),
    ['findings.headline_finding'],
  );
});

test('a child paper inventory remains local to the selected analysis', () => {
  const index = indexAnalysis(fixtureDocument);
  const papers = collectInventoryPapers(
    fixtureDocument,
    index,
    fixtureDocument.analysis.analyses[0],
  );

  assert.deepEqual(papers.map(({ doi }) => doi), ['10.5678/nested']);
});

test('the inventory index locates records with their owning analysis', () => {
  const index = indexAnalysis(fixtureDocument);
  assert.equal(locateRecord(index, 'outputs.headline').analysis.canonicalPath, '$');
  assert.equal(locateRecord(index, 'clustering.outputs.correlation').analysis.canonicalPath, 'clustering');
  assert.equal(locateRecord(index, 'outputs.missing'), undefined);
});

test('relations, evidence, and insight derivations follow provenance', () => {
  const index = indexAnalysis(fixtureDocument);
  const headline = index.recordByPath.get('outputs.headline');
  const relations = outputRelations(index, headline);
  assert.deepEqual(relations.inputs.map(({ record }) => record.id), ['catalog']);
  assert.deepEqual(relations.decisions.map(({ record }) => record.id), ['method']);
  assert.equal(relations.alias, undefined);

  const finding = index.recordByPath.get('findings.headline_finding');
  const evidence = findingEvidence(index, finding);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].output.canonicalPath, 'outputs.headline');

  const decision = index.recordByPath.get('decisions.method');
  assert.deepEqual(decisionInsights(index, decision).map(({ id }) => id), ['published_method']);

  const insight = index.recordByPath.get('prior_insights.published_method');
  assert.deepEqual(informedDecisions(fixtureDocument, insight).map(({ id }) => id), ['method']);
});

test('output relations list a record referenced twice only once', () => {
  const index = indexAnalysis(fixtureDocument);
  const headline = index.recordByPath.get('outputs.headline');
  const twice = {
    ...headline,
    provenance: { inputPaths: ['inputs.catalog', 'inputs.catalog'], decisionPaths: ['decisions.method', 'decisions.method'] },
  };
  const relations = outputRelations(index, twice);
  assert.deepEqual(relations.inputs.map(({ canonicalPath }) => canonicalPath), ['inputs.catalog']);
  assert.deepEqual(relations.decisions.map(({ canonicalPath }) => canonicalPath), ['decisions.method']);
});

test('finding literature is the DOI-bearing evidence, kept apart from artifact evidence', () => {
  const index = indexAnalysis(fixtureDocument);
  const finding = index.recordByPath.get('findings.headline_finding');
  assert.deepEqual(findingLiterature(finding).map(({ doi }) => doi), ['10.9999/finding']);
  assert.equal(findingEvidence(index, finding).length + findingLiterature(finding).length, finding.evidence.length);
});

test('delimited previews keep quoted delimiters, quotes, and line breaks inside one cell', () => {
  const preview = tablePreviewFromDelimited('name,note\r\n"Smith, J","says ""hi""\nand bye"\n\nplain,row\n');
  assert.deepEqual(preview.headers, ['name', 'note']);
  assert.deepEqual(preview.rows, [['Smith, J', 'says "hi"\nand bye'], ['plain', 'row']]);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.truncated, false);
});

test('a byte-limited delimited sample drops its cut-off last record and reports an unknown total', () => {
  const cut = tablePreviewFromDelimited('a,b\n1,2\n3,4\n5,', { sourceTruncated: true });
  assert.deepEqual(cut.rows, [['1', '2'], ['3', '4']]);
  assert.equal(cut.totalRows, undefined);
  assert.equal(cut.truncated, true);

  const cleanEnd = tablePreviewFromDelimited('a,b\n1,2\n3,4\n', { sourceTruncated: true });
  assert.deepEqual(cleanEnd.rows, [['1', '2'], ['3', '4']], 'a sample ending on a newline keeps its last record');
  assert.equal(cleanEnd.totalRows, undefined);

  const openQuote = tablePreviewFromDelimited('a,b\n1,2\n3,"multi\nline', { sourceTruncated: true });
  assert.deepEqual(openQuote.rows, [['1', '2']], 'an unterminated quoted record is dropped');

  const exact = tablePreviewFromDelimited('a,b\n1,2\n3,4\n5,6\n', { maxRows: 2 });
  assert.deepEqual(exact.rows, [['1', '2'], ['3', '4']]);
  assert.equal(exact.totalRows, 3);
  assert.equal(exact.truncated, true);
});

test('output decisions follow every dependency path: own provenance first, then upstream outputs, input and output aliases, sub-analyses; cycles ignored', () => {
  const root = fixtureDocument.analysis;
  const output = (id, provenance, decisions = []) => ({
    id, kind: 'output', canonicalPath: `outputs.${id}`, type: 'data', format: 'npy', active: true, inputs: [], decisions, provenance,
  });
  const upstream = output('upstream', { inputPaths: [], decisionPaths: ['decisions.method'] }, ['method']);
  const downstream = output('downstream', { inputPaths: ['outputs.upstream'], decisionPaths: [] });
  const viaAlias = output('via_alias', { inputPaths: ['inputs.alias'], decisionPaths: [] });
  const alreadyDirect = output('already_direct', { inputPaths: ['outputs.upstream'], decisionPaths: ['decisions.method'] }, ['method']);
  const loopA = output('loop_a', { inputPaths: ['outputs.loop_b'], decisionPaths: [] });
  const loopB = output('loop_b', { inputPaths: ['outputs.loop_a', 'outputs.upstream'], decisionPaths: [] });
  // A root-level alias of a sub-analysis output, and a fit over it: the
  // sub-analysis decision reaches both.
  const importedXi = { ...output('imported_xi', { inputPaths: [], decisionPaths: [] }), resolvedFrom: 'clustering.outputs.correlation' };
  const fit = output('fit', { inputPaths: ['outputs.imported_xi'], decisionPaths: ['decisions.method'] }, ['method']);
  const multipleRoutes = output('multiple_routes', {
    inputPaths: ['outputs.upstream', 'inputs.alias', 'outputs.loop_a', 'outputs.imported_xi'],
    decisionPaths: ['decisions.direct', 'decisions.direct'],
  });
  const alias = { id: 'alias', kind: 'input', canonicalPath: 'inputs.alias', type: 'data', resolvedFrom: 'outputs.upstream' };
  const weighting = { ...root.decisions[0], id: 'weighting', label: 'Weighting', canonicalPath: 'clustering.decisions.weighting' };
  const clustering = {
    ...root.analyses[0],
    decisions: [weighting],
    outputs: root.analyses[0].outputs.map((record) => ({ ...record, provenance: { ...record.provenance, decisionPaths: ['clustering.decisions.weighting'] } })),
  };
  const document = {
    ...fixtureDocument,
    analysis: {
      ...root,
      inputs: [...root.inputs, alias],
      outputs: [...root.outputs, upstream, downstream, viaAlias, alreadyDirect, loopA, loopB, importedXi, fit, multipleRoutes],
      analyses: [clustering],
    },
  };
  const index = indexAnalysis(document);
  assert.deepEqual(outputDecisionPaths(index, upstream), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, downstream), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, viaAlias), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, alreadyDirect), ['decisions.method'], 'a decision that is both direct and upstream is listed once');
  assert.deepEqual(outputDecisionPaths(index, loopA), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, importedXi), ['clustering.decisions.weighting'], 'an alias inherits the decisions of its target');
  assert.deepEqual(outputDecisionPaths(index, fit), ['decisions.method', 'clustering.decisions.weighting'], 'own decisions first, then those reached through a sub-analysis');
  assert.deepEqual(outputRelations(index, fit).decisions.map(({ record, analysis }) => [record.id, analysis.canonicalPath]), [['method', '$'], ['weighting', 'clustering']]);
  assert.deepEqual(outputDecisionRoutes(index, alreadyDirect), new Map(), 'direct decisions have no inherited routes');
  assert.deepEqual(outputDecisionRoutes(index, viaAlias), new Map([
    ['decisions.method', new Set(['outputs.upstream'])],
  ]), 'input aliases name their resolved upstream output');
  assert.deepEqual(outputDecisionRoutes(index, importedXi), new Map([
    ['clustering.decisions.weighting', new Set(['clustering.outputs.correlation'])],
  ]), 'output aliases name their source across analyses');
  assert.deepEqual(outputDecisionPaths(index, multipleRoutes), [
    'decisions.direct', 'decisions.method', 'clustering.decisions.weighting',
  ], 'direct decisions and first-discovered inherited decisions retain their order');
  assert.deepEqual(outputDecisionRoutes(index, multipleRoutes), new Map([
    ['decisions.method', new Set(['outputs.upstream', 'outputs.loop_a'])],
    ['clustering.decisions.weighting', new Set(['outputs.imported_xi'])],
  ]), 'shared ancestors retain every immediate route, deduplicating aliases and terminating cycles');
  assert.deepEqual(outputRelations(index, multipleRoutes).decisions.map(({ canonicalPath, via }) => [canonicalPath, via?.map((link) => link.canonicalPath)]), [
    ['decisions.direct', undefined],
    ['decisions.method', ['outputs.upstream', 'outputs.loop_a']],
    ['clustering.decisions.weighting', ['outputs.imported_xi']],
  ], 'the detail relations use the same decision order and route attribution');
});

const citing = (...evidence) => ({
  ...fixtureDocument,
  analysis: {
    ...fixtureDocument.analysis,
    analyses: [],
    findings: [],
    prior_insights: [{ ...fixtureDocument.analysis.prior_insights[0], evidence }],
  },
});

test('arXiv DOIs name their PDF; every other DOI is left to the DOI link', () => {
  assert.equal(arxivIdFromDoi('https://doi.org/10.48550/arXiv.1804.09366'), '1804.09366');
  assert.equal(arxivIdFromDoi('10.48550/arxiv.astro-ph/0604362'), 'astro-ph/0604362');
  assert.equal(arxivIdFromDoi('10.48550/arxiv.not-an-id'), undefined);
  assert.equal(arxivIdFromDoi('10.1093/mnras/stv1198'), undefined);
  assert.deepEqual(
    arxivPaperMetadata(citing(
      { id: 'a', doi: '10.48550/arXiv.1804.09366', version: 2 },
      { id: 'b', doi: '10.48550/arXiv.1804.09366', version: 3 },
      { id: 'c', doi: '10.1093/mnras/stv1198' },
    )),
    { '10.48550/arxiv.1804.09366': { pdfUrl: 'https://arxiv.org/pdf/1804.09366v3' } },
  );
});

test('an arXiv citation naming no revision reads the latest one', () => {
  assert.deepEqual(
    arxivPaperMetadata(citing(
      { id: 'a', doi: '10.48550/arXiv.1804.09366', version: 7 },
      { id: 'b', doi: '10.48550/arXiv.1804.09366' },
    )),
    { '10.48550/arxiv.1804.09366': { pdfUrl: 'https://arxiv.org/pdf/1804.09366' } },
  );
});

const source = (text, size = text.length) => ({
  url: 'https://host/files/out',
  size,
  reads: [],
  async readText(maxBytes) {
    this.reads.push(maxBytes);
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes };
  },
});
const output = (type, format) => ({ ...fixtureDocument.analysis.outputs[0], type, format });

test('a preview reads a bounded sample of the host-supplied bytes', async () => {
  const table = source('a,b\n1,2\n');
  assert.deepEqual(
    await artifactPreviewFromSource(output('table', 'csv'), table),
    tablePreviewFromDelimited('a,b\n1,2\n', { delimiter: ',', sourceTruncated: false }),
  );
  assert.deepEqual(table.reads, [65_536]);

  assert.deepEqual(await artifactPreviewFromSource(output('figure', 'png'), source('')), {
    kind: 'image',
    url: 'https://host/files/out',
  });
  assert.equal((await artifactPreviewFromSource(output('metric', 'json'), source('{"value": 0.7}'))).value, 0.7);
});

test('a preview refuses what it would have to read whole', async () => {
  const large = source('[]', 3_000_000);
  assert.equal((await artifactPreviewFromSource(output('table', 'json'), large)).kind, 'unavailable');
  assert.deepEqual(large.reads, []);
  assert.deepEqual(await artifactPreviewFromSource(output('data', 'npz'), source('')), {
    kind: 'unavailable',
    reason: 'No bounded preview is available for .npz artifacts.',
  });
  assert.equal((await artifactPreviewFromSource(output('table', 'json'), source('not json'))).reason,
    'The file is not a JSON table.');
});
