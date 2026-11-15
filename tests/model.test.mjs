import assert from 'node:assert/strict';
import test from 'node:test';
import { indexResolvedAnalysis } from '@astra-spec/sdk';
import { tablePreviewFromDelimited } from '../packages/react/dist/lib/index.js';
import {
  collectInventoryPapers,
  decisionInsights,
  findingEvidence,
  findingLiterature,
  groupFindingEvidence,
  outputDecisionPaths,
  outputDecisionRoutes,
  informedDecisions,
  locateRecord,
  outputRelations,
} from '../packages/react/dist/model/index.js';
import { fixtureDocument } from './fixture.mjs';

test('paper presentation data is derived from the SDK document and index', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  const papers = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analyses[0], {
    '10.1234/example': {
      title: 'A useful paper',
      authors: 'A. Researcher',
      pdfUrl: '/papers/example.pdf',
    },
  });

  assert.deepEqual(
    papers.map(({ doi }) => doi),
    ['10.1234/example', '10.5678/nested', '10.9999/finding'],
  );
  assert.equal(papers[0].title, 'A useful paper');
  assert.deepEqual(
    papers[0].insights.map(({ ref }) => ref),
    ['prior_insights.published_method', 'prior_insights.uncited_caveat'],
  );
  assert.deepEqual(
    papers[0].decisions.map(({ ref }) => ref),
    ['decisions.method'],
  );
  assert.deepEqual(
    papers[2].insights.map(({ ref }) => ref),
    ['findings.headline_finding'],
  );
});

test('a child paper inventory remains local to the selected analysis', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  const papers = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analyses[1]);

  assert.deepEqual(
    papers.map(({ doi }) => doi),
    ['10.5678/nested'],
  );
});

test('the inventory index locates records with their owning analysis', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  assert.equal(locateRecord(index, 'outputs.headline').analysis.key, '');
  assert.equal(locateRecord(index, 'clustering.outputs.correlation').analysis.key, 'clustering');
  assert.equal(locateRecord(index, 'outputs.missing'), undefined);
});

test('relations, evidence, and insight derivations follow provenance', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  const headline = index.elementByRef.get('outputs.headline')?.element;
  const relations = outputRelations(index, headline, 'universes.baseline');
  assert.deepEqual(
    relations.inputs.map(({ record }) => record.ref),
    ['inputs.catalog'],
  );
  assert.deepEqual(
    relations.decisions.map(({ record }) => record.ref),
    ['decisions.method'],
  );
  assert.equal(relations.alias, undefined);

  const finding = index.elementByRef.get('findings.headline_finding')?.element;
  const evidence = findingEvidence(index, finding);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].output.ref, 'outputs.headline');

  const decision = index.elementByRef.get('decisions.method')?.element;
  assert.deepEqual(
    decisionInsights(index, decision).map(({ ref }) => ref),
    ['prior_insights.published_method'],
  );

  const insight = index.elementByRef.get('prior_insights.published_method')?.element;
  assert.deepEqual(
    informedDecisions(fixtureDocument, insight).map(({ ref }) => ref),
    ['decisions.method'],
  );
});

test('output relations deduplicate effective result inputs and direct decisions', () => {
  const document = structuredClone(fixtureDocument);
  document.results[0].inputs.push(document.results[0].inputs[0]);
  document.analyses[0].outputs[0].decisions.push('decisions.method');
  const index = indexResolvedAnalysis(document);
  const relations = outputRelations(index, document.analyses[0].outputs[0], 'universes.baseline');
  assert.deepEqual(
    relations.inputs.map(({ canonicalPath }) => canonicalPath),
    ['inputs.catalog'],
  );
  assert.deepEqual(
    relations.decisions.map(({ canonicalPath }) => canonicalPath),
    ['decisions.method'],
  );
});

test('finding literature is the DOI-bearing evidence, kept apart from artifact evidence', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  const finding = index.elementByRef.get('findings.headline_finding')?.element;
  assert.deepEqual(
    findingLiterature(finding).map(({ doi }) => doi),
    ['10.9999/finding'],
  );
  assert.equal(findingEvidence(index, finding).length + findingLiterature(finding).length, finding.evidence.length);
});

test('delimited previews keep quoted delimiters, quotes, and line breaks inside one cell', () => {
  const preview = tablePreviewFromDelimited('name,note\r\n"Smith, J","says ""hi""\nand bye"\n\nplain,row\n');
  assert.deepEqual(preview.headers, ['name', 'note']);
  assert.deepEqual(preview.rows, [
    ['Smith, J', 'says "hi"\nand bye'],
    ['plain', 'row'],
  ]);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.truncated, false);
});

test('a byte-limited delimited sample drops its cut-off last record and reports an unknown total', () => {
  const cut = tablePreviewFromDelimited('a,b\n1,2\n3,4\n5,', { sourceTruncated: true });
  assert.deepEqual(cut.rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
  assert.equal(cut.totalRows, undefined);
  assert.equal(cut.truncated, true);

  const cleanEnd = tablePreviewFromDelimited('a,b\n1,2\n3,4\n', { sourceTruncated: true });
  assert.deepEqual(
    cleanEnd.rows,
    [
      ['1', '2'],
      ['3', '4'],
    ],
    'a sample ending on a newline keeps its last record',
  );
  assert.equal(cleanEnd.totalRows, undefined);

  const openQuote = tablePreviewFromDelimited('a,b\n1,2\n3,"multi\nline', { sourceTruncated: true });
  assert.deepEqual(openQuote.rows, [['1', '2']], 'an unterminated quoted record is dropped');

  const exact = tablePreviewFromDelimited('a,b\n1,2\n3,4\n5,6\n', { maxRows: 2 });
  assert.deepEqual(exact.rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
  assert.equal(exact.totalRows, 3);
  assert.equal(exact.truncated, true);
});

test('result dependencies follow pinned universes, driven sub-analyses and shared routes without looping', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0],
    child = document.analyses[1];
  const output = (id, decisions = []) => ({ ref: `outputs.${id}`, type: 'data', format: 'npy', tags: [], decisions });
  const upstream = output('upstream', ['decisions.method']),
    downstream = output('downstream'),
    loopA = output('loop_a'),
    loopB = output('loop_b'),
    imported = output('imported_xi'),
    fit = output('fit', ['decisions.method']),
    multiple = output('multiple_routes', ['decisions.direct']);
  root.outputs.push(upstream, downstream, loopA, loopB, imported, fit, multiple);
  root.decisions.push({ ...root.decisions[0], ref: 'decisions.direct' });
  child.decisions.push({ ...root.decisions[0], ref: 'clustering.decisions.weighting' });
  child.outputs[0].decisions = ['clustering.decisions.weighting'];
  const result = (id, record, dependencies, universe = 'universes.baseline') => ({
    id,
    output: record.ref,
    ...(universe ? { universe } : {}),
    places: [],
    inputs: dependencies.map((id) => ({ entry: id, result: id })),
  });
  document.results.push(
    result('opaque upstream id', upstream, [], 'universes.alternate'),
    result('downstream', downstream, ['opaque upstream id']),
    result('loopA', loopA, ['loopB']),
    result('loopB', loopB, ['loopA', 'opaque upstream id']),
    result('imported', imported, ['clustering.outputs.correlation'], undefined),
    result('fit', fit, ['imported']),
    result('multiple', multiple, ['opaque upstream id', 'loopA', 'imported']),
  );
  const index = indexResolvedAnalysis(document),
    universe = 'universes.baseline';
  assert.deepEqual(outputDecisionPaths(index, downstream, universe), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, loopA, universe), ['decisions.method']);
  assert.deepEqual(outputDecisionPaths(index, fit, universe), ['decisions.method', 'clustering.decisions.weighting']);
  assert.deepEqual(
    outputDecisionRoutes(index, multiple, universe),
    new Map([
      ['decisions.method', new Set(['outputs.upstream', 'outputs.loop_a'])],
      ['clustering.decisions.weighting', new Set(['outputs.imported_xi'])],
    ]),
  );
  assert.deepEqual(
    outputRelations(index, fit, universe).decisions.map(({ record, analysis }) => [record.ref, analysis.key]),
    [
      ['decisions.method', ''],
      ['clustering.decisions.weighting', 'clustering'],
    ],
  );
});

test('finding groups keep result IDs separate from output refs and authored artifact addresses', () => {
  const output = fixtureDocument.analyses[0].outputs[0];
  const collision = output.ref;
  const groups = groupFindingEvidence([
    {
      evidence: { artifact: collision },
      output,
      result: { id: collision, output: output.ref, places: [], inputs: [] },
    },
    { evidence: { artifact: collision }, output },
    { evidence: { artifact: collision } },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map((group) => group.key)).size, 3);
});

test('two pins to one varying output retain both decision selections and route contexts', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0];
  const compare = { ref: 'outputs.compare', type: 'data', format: 'json', tags: [], decisions: [] };
  root.outputs.push(compare);
  document.results.push({
    id: 'compare',
    output: compare.ref,
    universe: 'universes.baseline',
    places: [],
    inputs: [
      { entry: 'baseline input', result: 'outputs.headline#baseline' },
      { entry: 'alternate input', result: 'outputs.headline#alternate' },
    ],
  });
  const index = indexResolvedAnalysis(document),
    relations = outputRelations(index, compare, 'universes.baseline');
  assert.deepEqual(
    relations.decisions.map((link) => [
      link.canonicalPath,
      link.universeRef,
      link.via.map((via) => [via.canonicalPath, via.universeRef]),
    ]),
    [
      ['decisions.method', 'universes.baseline', [['outputs.headline', 'universes.baseline']]],
      ['decisions.method', 'universes.alternate', [['outputs.headline', 'universes.alternate']]],
    ],
  );
  assert.deepEqual(
    outputDecisionPaths(index, compare, 'universes.baseline'),
    ['decisions.method'],
    'ref-only summaries intentionally omit selection context',
  );
});

test('unplanned evidence links an authored output name through the SDK without fabricating a result', () => {
  const document = structuredClone(fixtureDocument),
    finding = document.analyses[0].findings[0];
  finding.evidence = [{ artifact: 'headline', cites: [] }];
  document.results = document.results.filter((result) => result.output !== 'outputs.headline');
  const [link] = findingEvidence(indexResolvedAnalysis(document), finding);
  assert.equal(link.output.ref, 'outputs.headline');
  assert.equal(link.analysis.key, '');
  assert.equal(link.result, undefined);
  assert.equal(link.evidence.artifact, 'headline');
});
