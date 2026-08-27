import assert from 'node:assert/strict';
import test from 'node:test';
import { indexAnalysis } from '@astra-spec/sdk';
import { tablePreviewFromDelimited } from '../packages/react/dist/components/index.js';
import {
  collectInventoryPapers,
  decisionInsights,
  findingEvidence,
  findingLiterature,
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
    ['prior_insights.published_method'],
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
