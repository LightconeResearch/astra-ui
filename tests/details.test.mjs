import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { indexResolvedAnalysis } from '@astra-spec/sdk';
import { FindingDetail, InputDetail } from '../packages/react/dist/components/index.js';
import { findingEvidence } from '../packages/react/dist/model/index.js';
import { fixtureDocument } from './fixture.mjs';

const index = indexResolvedAnalysis(fixtureDocument);
const record = (path) => index.elementByRef.get(path)?.element;
const html = (element) => renderToStaticMarkup(React.createElement('div', { className: 'astra-ui' }, element));

test('a finding shows its literature sources next to its supporting results', () => {
  const finding = record('findings.headline_finding');
  const markup = html(React.createElement(FindingDetail, { record: finding, evidence: findingEvidence(index, finding) }));
  assert.match(markup, /Supporting results/);
  assert.match(markup, /Headline result/);
  assert.match(markup, /Source paper/);
  assert.match(markup, /href="https:\/\/doi\.org\/10\.9999\/finding"/);
});

test('an input shows its repository path without inventing removed source or alias fields', () => {
  const input = { ...record('inputs.catalog'), ref: 'clustering.inputs.catalog', path: 'data/catalog.fits' };
  const markup = html(React.createElement(InputDetail, { record: input }));
  assert.match(markup, /<h4>Source<\/h4><code[^>]*>data\/catalog\.fits<\/code>/);
  assert.doesNotMatch(markup, /Resolved from/);
});
