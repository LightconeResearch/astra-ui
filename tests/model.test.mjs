import assert from 'node:assert/strict';
import test from 'node:test';
import { indexAnalysis } from '@astra-spec/sdk';
import { collectInventoryPapers } from '../packages/react/dist/index.js';
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
