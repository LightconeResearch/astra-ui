import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { indexAnalysis } from '@astra-spec/sdk';
import {
  DecisionDialog,
  FindingDialog,
  InputDialog,
  InsightDialog,
  PaperDialog,
} from '../packages/react/dist/components/index.js';
import { collectInventoryPapers } from '../packages/react/dist/model/index.js';
import { fixtureDocument } from './fixture.mjs';

const index = indexAnalysis(fixtureDocument);
const record = (path) => index.recordByPath.get(path);
const html = (element) => renderToStaticMarkup(React.createElement('div', { className: 'astra-ui' }, element));
const noop = () => undefined;

test('a caller\'s data-slot wins over the primitive default it builds on', () => {
  const markup = html(React.createElement(DecisionDialog, { record: record('decisions.method'), insights: [], onClose: noop, onBack: noop }));
  for (const slot of ['dialog', 'dialog-header', 'dialog-close', 'dialog-back', 'dialog-body', 'decision-detail']) {
    assert.match(markup, new RegExp(`data-slot="${slot}"`), `${slot} reaches the DOM`);
  }
  assert.doesNotMatch(markup, /data-slot="(button|icon-button|surface-header|detail-layout)"/, 'defaults do not shadow the caller');
});

test('kind dialogs forward HTML attributes to the dialog root', () => {
  const attrs = { id: 'host-id', 'data-testid': 'host-test', style: { color: 'red' }, onClose: noop };
  const papers = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis);
  const cases = {
    DecisionDialog: React.createElement(DecisionDialog, { ...attrs, record: record('decisions.method'), insights: [] }),
    FindingDialog: React.createElement(FindingDialog, { ...attrs, record: record('findings.headline_finding'), evidence: [] }),
    InputDialog: React.createElement(InputDialog, { ...attrs, record: record('inputs.catalog') }),
    InsightDialog: React.createElement(InsightDialog, { ...attrs, record: record('prior_insights.published_method'), decisions: [] }),
    PaperDialog: React.createElement(PaperDialog, { ...attrs, record: papers[0] }),
  };
  for (const [name, element] of Object.entries(cases)) {
    const markup = html(element);
    assert.match(markup, /<dialog[^>]*\sid="host-id"/, `${name} id`);
    assert.match(markup, /<dialog[^>]*data-testid="host-test"/, `${name} data attribute`);
    assert.match(markup, /<dialog[^>]*style="color:red"/, `${name} style`);
  }
});
