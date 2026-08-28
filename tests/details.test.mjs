import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { indexAnalysis } from '@astra-spec/sdk';
import { FindingDetail, InputDetail } from '../packages/react/dist/components/index.js';
import { findingEvidence } from '../packages/react/dist/model/index.js';
import { fixtureDocument } from './fixture.mjs';

const index = indexAnalysis(fixtureDocument);
const record = (path) => index.recordByPath.get(path);
const html = (element) => renderToStaticMarkup(React.createElement('div', { className: 'astra-ui' }, element));

test('a finding shows its literature sources next to its supporting results', () => {
  const finding = record('findings.headline_finding');
  const markup = html(React.createElement(FindingDetail, { record: finding, evidence: findingEvidence(index, finding) }));
  assert.match(markup, /Supporting results/);
  assert.match(markup, /Headline result/);
  assert.match(markup, /Source paper/);
  assert.match(markup, /href="https:\/\/doi\.org\/10\.9999\/finding"/);
});

test('an alias input shows the record it resolves from and its own source', () => {
  const alias = {
    ...record('inputs.catalog'),
    canonicalPath: 'clustering.inputs.catalog',
    resolvedFrom: 'inputs.catalog',
    source: 'https://data.example/catalog',
  };
  const markup = html(React.createElement(InputDetail, { record: alias }));
  assert.match(markup, /<h4>Resolved from<\/h4><code[^>]*>inputs\.catalog<\/code>/);
  assert.match(markup, /<h4>Source<\/h4><code[^>]*>https:\/\/data\.example\/catalog<\/code>/);

  const plain = html(React.createElement(InputDetail, { record: { ...record('inputs.catalog'), source: 'https://data.example/catalog' } }));
  assert.match(plain, /<h4>Source<\/h4><code[^>]*>https:\/\/data\.example\/catalog<\/code>/);
  assert.doesNotMatch(plain, /Resolved from/);
});
