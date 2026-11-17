import assert from 'node:assert/strict';
import test from 'node:test';
import { indexResolvedAnalysis } from '@astra-spec/sdk';
import { tablePreviewFromDelimited } from '../packages/react/dist/lib/index.js';
import {
  analysisUniverses,
  collectInventoryPapers,
  decisionInsights,
  doiHref,
  evidencePage,
  recordKind,
  universeTitles,
  findingEvidence,
  findingLiterature,
  groupFindingEvidence,
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
    relations.inputs.map(({ ref }) => ref),
    ['inputs.catalog'],
  );
  assert.deepEqual(
    relations.decisions.map(({ ref }) => ref),
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
  assert.deepEqual(
    outputRelations(index, downstream, universe).decisions.map((link) => link.ref),
    ['decisions.method'],
  );
  assert.deepEqual(
    outputRelations(index, loopA, universe).decisions.map((link) => link.ref),
    ['decisions.method'],
  );
  assert.deepEqual(
    outputRelations(index, fit, universe).decisions.map((link) => link.ref),
    ['decisions.method', 'clustering.decisions.weighting'],
  );
  assert.deepEqual(
    outputRelations(index, multiple, universe).decisions.map((link) => [
      link.ref,
      link.via?.map((via) => via.ref),
    ]),
    [
      ['decisions.direct', undefined],
      ['decisions.method', ['outputs.upstream', 'outputs.loop_a']],
      ['clustering.decisions.weighting', ['outputs.imported_xi']],
    ],
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
      link.ref,
      link.universeRef,
      link.via.map((via) => [via.ref, via.universeRef]),
    ]),
    [
      ['decisions.method', 'universes.baseline', [['outputs.headline', 'universes.baseline']]],
      ['decisions.method', 'universes.alternate', [['outputs.headline', 'universes.alternate']]],
    ],
  );
});

test('unplanned evidence links an authored output name through the SDK without fabricating a result', () => {
  const document = structuredClone(fixtureDocument),
    finding = document.analyses[0].findings[0];
  finding.evidence = [{ artifact: 'headline', cites: [], bindings: [{ universe: 'universes.baseline', output: 'outputs.headline' }] }];
  document.results = document.results.filter((result) => result.output !== 'outputs.headline');
  const [link] = findingEvidence(indexResolvedAnalysis(document), finding);
  assert.equal(link.output.ref, 'outputs.headline');
  assert.equal(link.analysis.key, '');
  assert.equal(link.result, undefined);
  assert.equal(link.evidence.artifact, 'headline');
});

test('binding context selects once-built switch cases and preserves pinned target context', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0],
    finding = root.findings[0];
  root.outputs.push(
    ...['a', 'b'].map((id) => ({ ref: `outputs.fixed_${id}`, type: 'data', format: 'txt', tags: [], decisions: [] })),
  );
  document.results.push(
    ...['a', 'b'].map((id) => ({ id: `fixed-${id}`, output: `outputs.fixed_${id}`, places: [], inputs: [] })),
  );
  finding.evidence = [
    {
      artifact: 'choice',
      cites: ['fixed-a', 'fixed-b'],
      bindings: [
        { universe: 'universes.baseline', output: 'outputs.fixed_a', result: 'fixed-a' },
        { universe: 'universes.alternate', output: 'outputs.fixed_b', result: 'fixed-b' },
      ],
    },
  ];
  let index = indexResolvedAnalysis(document);
  assert.deepEqual(
    findingEvidence(index, finding, 'universes.baseline').map((link) => link.result.id),
    ['fixed-a'],
  );
  assert.deepEqual(
    findingEvidence(index, finding, 'universes.alternate').map((link) => link.result.id),
    ['fixed-b'],
  );
  finding.evidence = [
    {
      artifact: 'summary#alternate',
      cites: [],
      bindings: [
        { universe: 'universes.alternate', output: 'outputs.summary', target_universe: 'universes.alternate' },
      ],
    },
  ];
  index = indexResolvedAnalysis(document);
  const [pinned] = findingEvidence(index, finding, 'universes.baseline');
  assert.equal(pinned.output.ref, 'outputs.summary');
  assert.equal(pinned.universeRef, 'universes.alternate');
  assert.equal(pinned.result, undefined);
});

test('explicit empty bindings do not fall back to authored output identity', () => {
  const document = structuredClone(fixtureDocument),
    finding = document.analyses[0].findings[0];
  finding.evidence = [{ artifact: 'headline', cites: [], bindings: [] }];
  assert.deepEqual(findingEvidence(indexResolvedAnalysis(document), finding, 'universes.baseline'), []);
});

test('an unplanned output exposes authored canonical inputs and relevant switch cases', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0],
    output = root.outputs[1];
  output.inputs = [
    { entry: 'catalog', target: 'inputs.catalog' },
    { entry: 'headline#alternate', target: 'outputs.headline', universe: 'universes.alternate' },
    { entry: 'choice', target: 'switches.choice' },
  ];
  root.switches = [
    {
      ref: 'switches.choice',
      decision: 'decisions.method',
      cases: {
        fiducial: { entry: 'headline', target: 'outputs.headline' },
        alternate: { entry: 'clustering.correlation', target: 'clustering.outputs.correlation' },
      },
    },
  ];
  const relations = outputRelations(indexResolvedAnalysis(document), output, 'universes.baseline');
  assert.deepEqual(
    relations.inputs.map((link) => [link.ref, link.universeRef]),
    [
      ['inputs.catalog', undefined],
      ['outputs.headline', 'universes.alternate'],
      ['switches.choice', undefined],
    ],
  );
  assert.deepEqual(relations.switches, root.switches);
  assert.equal(
    document.results.some((result) => result.output === output.ref),
    false,
  );
});

test('a decision selecting a seed input switch is direct even though its trace contains a source edge', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0];
  const compare = {
    ref: 'outputs.compare',
    type: 'data',
    format: 'json',
    tags: [],
    decisions: [],
    inputs: [{ entry: 'choice', target: 'switches.choice' }],
  };
  root.outputs.push(compare);
  root.switches = [
    {
      ref: 'switches.choice',
      decision: 'decisions.method',
      cases: { fiducial: { entry: 'headline', target: 'outputs.headline' } },
    },
  ];
  document.results.push({
    id: 'compare',
    output: compare.ref,
    universe: 'universes.baseline',
    places: [],
    inputs: [{ entry: 'choice', result: 'outputs.headline#baseline' }],
  });
  const relations = outputRelations(indexResolvedAnalysis(document), compare, 'universes.baseline');
  assert.equal(relations.decisions.length, 1);
  assert.equal(relations.decisions[0].ref, 'decisions.method');
  assert.equal(relations.decisions[0].via, undefined);
});

test('a switch binding with no case retains unavailable evidence and its evaluation context', () => {
  const document = structuredClone(fixtureDocument),
    root = document.analyses[0],
    finding = root.findings[0];
  finding.evidence = [{ artifact: 'choice', cites: [], bindings: [{ universe: 'universes.baseline' }] }];
  const links = findingEvidence(indexResolvedAnalysis(document), finding, 'universes.baseline');
  assert.equal(links.length, 1);
  assert.equal(links[0].output, undefined);
  assert.equal(links[0].result, undefined);
  assert.equal(links[0].universeRef, 'universes.baseline');
  assert.equal(groupFindingEvidence(links)[0].artifact, 'choice');
});

test('a DOI written with its label and its resolver URL normalizes to one key', () => {
  assert.equal(doiHref('doi: https://doi.org/10.48550/arXiv.2404.03000 '), 'https://doi.org/10.48550/arxiv.2404.03000');
  assert.equal(doiHref(' DOI:10.1234/EXAMPLE'), 'https://doi.org/10.1234/example');
});

test('a literature location names a page only through its page fragment', () => {
  assert.equal(evidencePage({ location: { value: 'page=22' } }), 22);
  assert.equal(evidencePage({ location: { value: 'section=2&page=7' } }), 7);
  assert.equal(evidencePage({ location: { value: 'section=2' } }), undefined);
  assert.equal(evidencePage({}), undefined);
});

test('artifact evidence without binding information still names its output, not an empty selection', () => {
  const document = structuredClone(fixtureDocument);
  // An older report: the decoder accepts evidence with no `bindings` key.
  document.analyses[0].findings[0].evidence = [
    { artifact: 'headline' },
    { artifact: 'nowhere' },
    { artifact: 'headline#alternate' },
    { doi: '10.9999/finding' },
  ];
  const index = indexResolvedAnalysis(document);
  const links = findingEvidence(index, document.analyses[0].findings[0], 'universes.alternate');
  assert.deepEqual(
    links.map(({ evidence, output, result, universeRef }) => [evidence.artifact, output?.ref, result?.id, universeRef]),
    [
      // Shown with the viewed universe's result...
      ['headline', 'outputs.headline', 'outputs.headline#alternate', 'universes.alternate'],
      // ...kept, unresolved, when the address names no output...
      ['nowhere', undefined, undefined, undefined],
      // ...and never re-bound to the viewed universe when the address pins one.
      ['headline#alternate', 'outputs.headline', undefined, undefined],
    ],
  );
});

test('the universes offered for an analysis are the ones that evaluate it', () => {
  const document = structuredClone(fixtureDocument);
  // The child declares a universe of its own, labelled like one of the root's,
  // and its output is also built in the root's baseline.
  document.analyses[1].universes = [{ ref: 'clustering.universes.fast', label: 'Baseline', selection: {}, tags: [] }];
  document.results[2] = { ...document.results[2], id: 'clustering.outputs.correlation#baseline', universe: 'universes.baseline' };
  const index = indexResolvedAnalysis(document);
  const refs = (analysis) => analysisUniverses(index, analysis).map(({ ref }) => ref);
  // The child's universe evaluates nothing the root declares.
  assert.deepEqual(refs(document.analyses[0]), ['universes.baseline', 'universes.alternate']);
  // A sub-analysis is evaluated in its own universes and in every one its parent declares.
  assert.deepEqual(refs(document.analyses[1]), ['clustering.universes.fast', 'universes.baseline', 'universes.alternate']);
  assert.deepEqual(universeTitles(analysisUniverses(index, document.analyses[1])), [
    'Baseline (clustering.universes.fast)',
    'Baseline (universes.baseline)',
    'Alternate',
  ]);
});

test('a back-reference to the parent does not make a sub-analysis its parent\'s ancestor', () => {
  const document = structuredClone(fixtureDocument);
  document.analyses[1].declares = { parent: '' };
  document.analyses[1].universes = [{ ref: 'clustering.universes.fast', selection: {}, tags: [] }];
  const index = indexResolvedAnalysis(document);
  assert.deepEqual(
    analysisUniverses(index, document.analyses[0]).map(({ ref }) => ref),
    ['universes.baseline', 'universes.alternate'],
  );
});

test('a record kind comes from the declaring collection, or from every field its type requires', () => {
  const index = indexResolvedAnalysis(fixtureDocument);
  // An open-schema input may carry a `format` of its own.
  assert.equal(recordKind({ ref: 'inputs.raw', path: 'data/raw.fits', format: 'fits', tags: [] }), 'input');
  assert.equal(recordKind(fixtureDocument.analyses[0].outputs[0]), 'output');
  assert.equal(recordKind(fixtureDocument.analyses[0].decisions[0]), 'decision');
  // With an index the collection decides, whatever the shape.
  assert.equal(recordKind({ ref: 'outputs.headline', path: 'x', tags: [] }, index), 'output');
});
