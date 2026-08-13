import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ArtifactPreview,
  createInventoryModel,
  DecisionDialog,
  FindingDialog,
  GraphExplorer,
  InputDialog,
  InsightDetailDialog,
  InventoryDetailDialog,
  InventoryDetailPresentation,
  InventoryExplorer,
  InventoryProse,
  InventoryRelationList,
  OverviewInventory,
  OutputDetail,
  OutputDialog,
  PaperDialog,
} from '../packages/react/dist/index.js';
import { fixtureModel } from './model.test.mjs';

test('inventory renders the canonical model without a host dependency', () => {
  const model = fixtureModel();
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryExplorer, {
        model,
        scopeId: 'root',
      }),
    ),
  );

  assert.match(html, /heading-text">Outputs</);
  assert.match(html, /heading-text">Decisions</);
  assert.match(html, /heading-text">Inputs</);
  assert.match(html, /heading-text">Findings</);
  assert.match(html, /heading-text">Papers</);
  assert.match(html, /inventory-page-layout/);
  assert.match(html, /On this page/);
  assert.match(html, /inventory-page-outline/);
  assert.match(html, /inventory-paper-list/);
  assert.match(html, /headline/);
  assert.match(html, /Fiducial/);
  assert.match(html, /10\.0000\/example/);
  assert.doesNotMatch(html, /jupyter|myst/i);
});

test('Claude-style inventory shells retain kind-specific record information', () => {
  const model = fixtureModel();
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryExplorer, {
        model,
        scopeId: 'root',
      }),
    ),
  );

  // Output cards keep the real artifact preview and open affordance.
  assert.match(html, /inventory-output-card__preview/);
  assert.match(html, /Open ↗/);
  assert.match(html, /headline/);

  // Compact rows remain record-aware rather than becoming generic mock cards.
  assert.match(html, /inventory-records--decisions/);
  assert.match(html, /Fiducial/);
  assert.match(html, /inventory-records--inputs/);
  assert.match(html, /data-kind="input"/);

  // Paper cards retain citation identity and relationship counts.
  assert.match(html, /inventory-paper-list__copy/);
  assert.match(html, /10\.0000\/example/);
  assert.match(html, /1 insight/);
  assert.match(html, /1 decision/);
});

test('inventory prose typesets inline and display LaTeX with KaTeX', () => {
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryProse, {
        text: 'Peak at $s^2\\,\\Delta\\xi_\\ell(s)$ with `qiso`. $$\\alpha_\\mathrm{iso} = 1$$',
      }),
    ),
  );

  assert.match(html, /inventory-prose__inline-math/);
  assert.match(html, /inventory-prose__display-math/);
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /katex-mathml/);
  assert.match(html, /katex-html/);
  assert.match(html, /<code>qiso<\/code>/);
});

test('canonical models preserve the complete rich inventory presentation', () => {
  const model = fixtureModel({ universeId: 'baseline' });
  const inventory = createInventoryModel(model);
  const headline = inventory.recordByPath.get('outputs.headline')?.record;
  assert.equal(headline?.kind, 'output');
  assert.deepEqual(headline?.provenance.inputs, [
    {
      reference: 'clustering.xi',
      recordId: 'clustering:output:xi',
      direct: true,
    },
    {
      reference: 'catalog',
      recordId: 'root:input:catalog',
      label: 'Input catalogue',
      direct: false,
    },
  ]);
  assert.deepEqual(
    headline?.provenance.decisions.map(({ recordId, scopeId }) => [recordId, scopeId]),
    [
      ['root:decision:method', undefined],
      ['clustering:decision:weighting', 'clustering'],
    ],
  );
  assert.equal(
    inventory.recordByPath.get('clustering.outputs.xi')?.record.relations
      .find((relation) => relation.kind === 'aliases')?.targetRecordId,
    'root:output:headline',
  );
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(InventoryExplorer, {
        model,
        scopeId: 'root',
      }),
    ),
  );

  assert.match(html, /heading-text">Outputs</);
  assert.match(html, /heading-text">Decisions</);
  assert.match(html, /heading-text">Inputs</);
  assert.match(html, /heading-text">Findings</);
  assert.match(html, /heading-text">Papers</);
  assert.match(html, /headline/);
  assert.match(html, /Fiducial/);
  assert.match(html, /10\.0000\/example/);
});

test('analysis hierarchy preserves the standalone recursive scope selector', () => {
  const model = fixtureModel();
  const html = renderToStaticMarkup(
    React.createElement(OverviewInventory, {
      model,
      scopeId: 'root',
      onSelectScope: () => {},
    }),
  );

  assert.match(html, /DESI demo/);
  assert.match(html, /Clustering/);
  assert.match(html, /Project hierarchy/);
});

test('artifact previews render host-safe data rather than paths', () => {
  const html = renderToStaticMarkup(
    React.createElement(ArtifactPreview, {
      preview: {
        kind: 'table',
        headers: ['tracer', 'alpha'],
        rows: [['LRG', 1.002]],
      },
    }),
  );
  assert.match(html, /tracer/);
  assert.match(html, /1\.002/);
  assert.doesNotMatch(html, /results\//);
});

test('shared detail headers pair record type with title and dismissal', () => {
  const html = renderToStaticMarkup(
    React.createElement(InventoryDetailDialog, {
      kind: 'decision',
      eyebrow: 'Decision · Root analysis',
      title: 'Method choice',
      identifier: 'decisions.method',
      closeLabel: 'Close decision details',
      onClose: () => {},
      children: React.createElement('p', null, 'Decision content'),
    }),
  );

  assert.match(html, /inventory-detail-dialog__header astra-surface-header|astra-surface-header inventory-detail-dialog__header/);
  assert.match(html, /data-density="compact"/);
  assert.match(html, /data-kind="decision"/);
  assert.match(html, /<dialog/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Close decision details"/);
  assert.match(html, /inventory-detail-dialog__kind">Decision</);
  assert.match(html, /Method choice/);
  assert.doesNotMatch(html, /decisions\.method/);
  assert.doesNotMatch(html, /Root analysis/);
  assert.match(html, /Decision content/);
});

test('embedded record details preserve the in-place record trail without opening a modal', () => {
  const html = renderToStaticMarkup(
    React.createElement(InventoryDetailPresentation, {
      mode: 'embedded',
      backLabel: 'Back to inventory',
      backText: 'Inventory',
      children: React.createElement(InventoryDetailDialog, {
        kind: 'output',
        eyebrow: 'Figure · Root analysis',
        title: 'Headline result',
        backLabel: 'Back to inventory',
        onBack: () => {},
        closeLabel: 'Close output details',
        onClose: () => {},
        children: React.createElement('p', null, 'Output content'),
      }),
    }),
  );

  assert.match(html, /inventory-detail-dialog--embedded/);
  assert.match(html, /inventory-detail-dialog__kind">Figure</);
  assert.match(html, /inventory-detail-dialog__crumb">Inventory</);
  assert.match(html, /Headline result/);
  assert.match(html, /aria-label="Close output details"/);
  assert.match(html, /inventory-detail-dialog__back/);
  assert.doesNotMatch(html, /Root analysis/);
  assert.doesNotMatch(html, /<dialog/);
});

test('embedded details span the record and oversized tables scroll internally', () => {
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /inventory-detail-dialog--embedded \.inventory-record-detail__main[\s\S]*?max-width:\s*none/,
  );
  assert.match(
    css,
    /inventory-detail-dialog--embedded \.inventory-output-provenance[\s\S]*?max-width:\s*none/,
  );
  assert.match(
    css,
    /inventory-output-dialog__preview\.is-table > \.inventory-output-table[\s\S]*?overflow:\s*auto/,
  );
  assert.match(
    css,
    /inventory-output-dialog__preview\.is-table thead[\s\S]*?position:\s*sticky/,
  );
  assert.match(
    css,
    /inventory-output-dialog__layout--reader[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) clamp\(19\.5rem, 27%, 21rem\)/,
  );
  assert.match(
    css,
    /inventory-detail-dialog--output-reader > section[\s\S]*?width:\s*min\(78rem, 100%\)/,
  );
  assert.match(
    css,
    /inventory-output-dialog__preview > img[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%[\s\S]*?object-fit:\s*contain/,
  );
  assert.match(
    css,
    /is-expanded \.inventory-artifact-fullscreen__header[\s\S]*?width:\s*100%[\s\S]*?justify-content:\s*space-between/,
  );
  assert.match(
    css,
    /inventory-output-artifact\.is-expanded[\s\S]*?position:\s*fixed[\s\S]*?inset:\s*0/,
  );
});

test('figure and table results use a reader layout with description before recipe in the rail', () => {
  const inventory = createInventoryModel(fixtureModel());
  const record = inventory.recordByPath.get('outputs.headline')?.record;
  const scope = inventory.scopeById.get('root');
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );
  assert.equal(record?.kind, 'output');
  assert.ok(scope);

  const html = renderToStaticMarkup(
    React.createElement(OutputDetail, {
      record: { ...record, description: 'The primary result description.' },
      scope,
      model: inventory,
    }),
  );

  assert.match(html, /inventory-output-dialog__layout--reader/);
  assert.match(html, /inventory-output-artifact/);
  assert.match(html, /inventory-artifact-fullscreen__header/);
  assert.doesNotMatch(html, /inventory-output-artifact__fullscreen/);
  assert.match(html, /<small>Full screen<\/small>/);
  assert.match(html, /aria-label="Exit full-screen result"/);
  assert.match(html, /The primary result description/);
  assert.match(html, /inventory-output-provenance-slot/);
  assert.doesNotMatch(html, />Direct</);
  assert.doesNotMatch(html, />Indirect</);
  assert.doesNotMatch(html, />Upstream output</);
  assert.doesNotMatch(html, />Input</);
  assert.ok(
    html.indexOf('inventory-output-provenance-slot') < html.indexOf('The primary result description'),
  );
  assert.ok(
    html.indexOf('The primary result description') < html.indexOf('Recipe'),
  );
  assert.doesNotMatch(html, /No decisions are referenced directly by this output recipe\./);
  assert.match(
    css,
    /inventory-output-provenance > \.inventory-output-description--rail[\s\S]*?border-bottom:\s*0/,
  );

  const dialogHtml = renderToStaticMarkup(
    React.createElement(OutputDialog, {
      record: { ...record, description: 'The primary result description.' },
      scope,
      model: inventory,
      onOpenDependency: () => {},
      onClose: () => {},
    }),
  );
  assert.match(dialogHtml, /inventory-detail-dialog--reader inventory-detail-dialog--output-reader/);
  assert.match(dialogHtml, /aria-label="View figure full screen"/);
  assert.match(dialogHtml, /inventory-detail-dialog__header-action/);
  assert.doesNotMatch(dialogHtml, /inventory-output-artifact__fullscreen/);
  assert.doesNotMatch(dialogHtml, /Open ↗/);

  const tableDialogHtml = renderToStaticMarkup(
    React.createElement(OutputDialog, {
      record: { ...record, outputType: 'table' },
      scope,
      model: inventory,
      onOpenDependency: () => {},
      onClose: () => {},
    }),
  );
  assert.match(tableDialogHtml, /inventory-output-artifact is-table/);
  assert.match(tableDialogHtml, /aria-label="View table full screen"/);
  assert.match(tableDialogHtml, /inventory-detail-dialog__header-action/);
  assert.doesNotMatch(tableDialogHtml, /inventory-output-artifact__fullscreen/);
});

test('non-visual results keep details in one main column without a large preview', () => {
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );
  const inventory = createInventoryModel(fixtureModel());
  const record = inventory.recordByPath.get('outputs.headline')?.record;
  const scope = inventory.scopeById.get('root');
  assert.equal(record?.kind, 'output');
  assert.ok(scope);

  const html = renderToStaticMarkup(
    React.createElement(OutputDetail, {
      record: {
        ...record,
        outputType: 'metric',
        metric: { value: 1.002, uncertainty: 0.008, unit: 'ratio' },
        description: 'A compact scalar result.',
      },
      scope,
      model: inventory,
    }),
  );

  assert.match(html, /inventory-output-dialog__layout--single/);
  assert.match(html, /inventory-output-dialog__inline-result/);
  assert.match(html, /A compact scalar result/);
  assert.match(html, /inventory-output-provenance is-inline/);
  assert.doesNotMatch(html, /inventory-output-dialog__preview/);
  assert.doesNotMatch(html, /inventory-output-provenance-slot/);
  assert.doesNotMatch(html, /View result full screen/);
  assert.match(
    css,
    /inventory-output-dialog__layout--single \.inventory-output-provenance[\s\S]*?border:\s*0/,
  );
});

test('input dialogs size to their content and scroll long source paths horizontally', () => {
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );
  const inventory = createInventoryModel(fixtureModel());
  const record = inventory.recordByPath.get('inputs.catalog')?.record;
  const scope = inventory.scopeById.get('root');
  assert.equal(record?.kind, 'input');
  assert.ok(scope);

  const html = renderToStaticMarkup(
    React.createElement(InputDialog, {
      record: {
        ...record,
        source: '/a/very/long/source/path/that/is/wider/than/the/input/dialog/path/pill/catalog.fits',
      },
      scope,
      onClose: () => {},
    }),
  );

  assert.match(html, /inventory-detail-dialog--input/);
  assert.match(html, /inventory-record-detail__prose--section-heading/);
  assert.match(html, /<code tabindex="0" title="\/a\/very\/long\/source\/path/);
  assert.match(
    css,
    /inventory-detail-dialog--input,[\s\S]*?inventory-detail-dialog--finding[\s\S]*?\) > section[\s\S]*?height:\s*auto/,
  );
  assert.match(
    css,
    /inventory-detail-dialog--input \.inventory-input-source code[\s\S]*?max-width:\s*100%[\s\S]*?overflow-x:\s*auto[\s\S]*?overflow-y:\s*hidden[\s\S]*?white-space:\s*nowrap/,
  );
});

test('finding dialogs show notes without a leading section gap and list supporting results', () => {
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );
  const inventory = createInventoryModel(fixtureModel());
  const scope = inventory.scopeById.get('root');
  assert.ok(scope);

  const html = renderToStaticMarkup(
    React.createElement(FindingDialog, {
      record: {
        id: 'root:finding:sharper_peak',
        localId: 'sharper_peak',
        canonicalPath: 'findings.sharper_peak',
        scopeId: 'root',
        kind: 'finding',
        relations: [],
        claim: 'The reconstructed peak is sharper.',
        notes: 'The result is visible in the primary figure.',
        evidence: [{
          artifactRecordId: 'root:output:headline',
          quote: 'This quote should not be repeated in the supporting-results list.',
        }],
      },
      scope,
      model: inventory,
      onOpenEvidence: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /inventory-finding-detail__notes/);
  assert.match(html, /inventory-detail-dialog--finding/);
  assert.match(html, /Supporting results/);
  assert.match(html, /inventory-finding-supporting-results/);
  assert.match(html, /aria-label="View supporting result: headline"/);
  assert.match(html, /outputs\.headline/);
  assert.doesNotMatch(html, /inventory-finding-evidence-preview/);
  assert.doesNotMatch(html, /This quote should not be repeated/);
  assert.match(
    css,
    /inventory-finding-detail__notes:first-child\s*\{[\s\S]*?margin-top:\s*0/,
  );
  assert.match(
    css,
    /inventory-detail-dialog--finding[\s\S]*?> section[\s\S]*?height:\s*auto/,
  );
});

test('long inventory row collections scroll inside their own section', () => {
  const css = readFileSync(
    new URL('../packages/react/inventory.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /inventory-record-list__body,[\s\S]*?inventory-paper-list[\s\S]*?max-height:\s*min\(28rem, 55vh\)[\s\S]*?overflow-y:\s*auto/,
  );
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
});

test('paper details use compact insight and informed-decision lists', () => {
  const html = renderToStaticMarkup(
    React.createElement(PaperDialog, {
      paper: {
        doi: '10.0000/example',
        title: 'Example paper',
        pdfUrl: 'https://example.test/paper.pdf',
        insights: [{
          id: 'root:prior_insight:a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          localId: 'a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          canonicalPath: 'prior_insights.a_very_long_prior_insight_identifier_that_must_stay_inside_the_rail',
          scopeId: 'root',
          kind: 'prior_insight',
          relations: [],
          claim: 'A compact claim preview.',
          evidence: [{ doi: '10.0000/example', quote: 'A source passage.' }],
        }],
        decisions: [{
          id: 'root:decision:method',
          localId: 'method',
          canonicalPath: 'decisions.method',
          scopeId: 'root',
          kind: 'decision',
          label: 'Method choice',
          relations: [],
          options: [],
        }],
      },
      scope: {
        id: 'root',
        canonicalPath: 'root',
        name: 'Example',
        childIds: [],
        recordIds: [],
      },
      onOpenInsight: () => {},
      onOpenDecision: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /inventory-paper-insights/);
  assert.match(html, /inventory-paper-insight__claim/);
  assert.match(html, /Informs decisions/);
  assert.match(html, /inventory-paper-informs/);
  assert.doesNotMatch(html, />prior insight</);
  assert.doesNotMatch(html, /inventory-paper-insight__quote/);
  assert.doesNotMatch(html, /View paper full screen/);
  assert.doesNotMatch(html, /Exit full-screen paper/);
  assert.doesNotMatch(html, /Full screen/);
});

test('decision rationale and input description use section-heading typography', () => {
  const inventory = createInventoryModel(fixtureModel());
  const scope = inventory.scopeById.get('root');
  const decision = inventory.recordByPath.get('decisions.method')?.record;
  assert.ok(scope);
  assert.equal(decision?.kind, 'decision');

  const html = renderToStaticMarkup(
    React.createElement(DecisionDialog, {
      record: { ...decision, rationale: 'The rationale text.' },
      scope,
      model: inventory,
      onOpenInsight: () => {},
      onClose: () => {},
    }),
  );
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );

  assert.match(html, /inventory-record-detail__prose--section-heading/);
  assert.match(html, />Rationale</);
  assert.match(html, />Options</);
  assert.match(
    css,
    /inventory-record-detail__prose\.inventory-record-detail__prose--section-heading > span[\s\S]*?font:\s*700 0\.875rem\/1\.2/,
  );
});

test('paper viewer gives the document most of the available width', () => {
  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /inventory-paper-dialog__layout[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) clamp\(17\.5rem, 27%, 20rem\)/,
  );
  assert.doesNotMatch(css, /minmax\(23\.75rem, 0\.9fr\)/);
  assert.match(
    css,
    /inventory-detail-dialog--embedded \.inventory-paper-dialog__rail[\s\S]*?padding:\s*1\.125rem 1rem 1\.5rem/,
  );
});

test('relationship lists share compact typed rows instead of pill boxes', () => {
  const html = renderToStaticMarkup(
    React.createElement(InventoryRelationList, {
      title: 'Dependencies',
      items: [{
        key: 'method',
        label: 'Method choice',
        kind: 'decision',
        detail: 'Direct',
        onOpen: () => {},
      }],
      empty: 'No dependencies.',
    }),
  );

  assert.match(html, /inventory-relation-item__glyph/);
  assert.match(html, /data-kind="decision"/);
  assert.match(html, />◇</);
  assert.match(html, /Method choice/);
  assert.match(html, /Direct/);
  assert.match(html, /inventory-relation-item__label/);
  assert.doesNotMatch(html, /<strong>Method choice<\/strong>/);
});

test('insight details use the same compact informed-decision relationship', () => {
  const model = createInventoryModel(fixtureModel());
  const scope = model.model.scopes[0];
  const insight = model.recordById.get('root:prior_insight:published_method');
  assert.ok(insight);
  assert.equal(insight.kind, 'prior_insight');

  const html = renderToStaticMarkup(
    React.createElement(InsightDetailDialog, {
      insight,
      model,
      scope,
      onOpenDecision: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /Informs decisions/);
  assert.match(html, /data-kind="decision"/);
  assert.doesNotMatch(html, /decisions\.method/);

  const css = readFileSync(
    new URL('../packages/react/components.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /inventory-relation-item__label\s*\{[\s\S]*?font:\s*400 0\.8125rem\/1\.25/,
  );
  assert.match(
    css,
    /inventory-insight-trigger__claim\s*\{[\s\S]*?font:\s*400 0\.8125rem\/1\.35/,
  );
});

test('graph shows the structural ASTRA projection behind an explicit first-run choice', () => {
  const model = fixtureModel({ analysisRevision: 'analysis-graph-react' });
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(GraphExplorer, {
        model,
        onOrganize: () => {},
      }),
    ),
  );

  assert.match(html, /astra-project-view-header astra-graph__toolbar/);
  assert.match(html, /astra-project-view-header__title/);
  assert.match(html, /How would you like to begin/);
  assert.match(html, /Structural ASTRA graph/);
  assert.match(html, /Organize graph with AI/);
  assert.match(html, /View ungrouped graph/);
  assert.match(html, /DESI demo/);
  assert.match(html, /Clustering ASTRA sub-analysis; click to inspect/);
  assert.match(html, /xi: clustering\.outputs\.xi/);
  assert.match(html, />From Clustering<\/small>/);
  assert.doesNotMatch(html, />Sub-analysis · Clustering<\/small>/);
  assert.doesNotMatch(html, /astra-graph-node__detail[^>]*>Input<\/small>/);
  assert.match(html, /data-node-type="scope"/);
  assert.doesNotMatch(html, /visible nodes|canonical links/);
  assert.match(html, /headline/);
  assert.match(html, /Graph grammar/);
  assert.match(html, /aria-haspopup="true"/);
  assert.doesNotMatch(html, /astra-graph__legend-menu/);
  assert.match(html, /astra-graph__decision-panel/);
  assert.match(html, /data-open="false"/);
  assert.match(html, /aria-label="Expand decisions"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />1<\/strong>/);
  assert.match(html, /Interactive ASTRA graph canvas/);
  assert.match(html, /react-flow__controls/);
  assert.doesNotMatch(html, /astra-graph__decision-row/);
  assert.doesNotMatch(html, /react-flow__edge[^>]*astra-graph-edge--decision/);
  assert.doesNotMatch(html, /astra-graph__inspector/);
  assert.doesNotMatch(html, /data-kind="prior_insight"/);
  assert.doesNotMatch(html, /data-kind="finding"/);
  assert.doesNotMatch(html, /class="astra-graph-node"[^>]*data-kind="decision"/);
  assert.match(html, /react-flow__arrowhead/);
});

test('grouped records use a stacked kind icon without expanding the graph', () => {
  const model = fixtureModel({ analysisRevision: 'analysis-react-groups' });
  for (const localId of ['chart_a', 'chart_b']) {
    model.records.push({
      id: `root:output:${localId}`,
      localId,
      canonicalPath: `outputs.${localId}`,
      scopeId: 'root',
      kind: 'output',
      relations: [
        { kind: 'depends_on', targetRecordId: 'root:input:catalog', direct: true },
        { kind: 'parameterized_by', targetRecordId: 'root:decision:method', direct: true },
      ],
      outputType: 'figure',
      resourceIds: [],
      provenance: {
        inputs: [
          { reference: 'catalog', recordId: 'root:input:catalog', direct: true },
        ],
        decisions: [
          { reference: 'method', recordId: 'root:decision:method', direct: true },
        ],
      },
    });
    model.scopes[0].recordIds.push(`root:output:${localId}`);
  }
  const organization = {
    schema_version: 'graph-organization.v1',
    source: {
      entrypoint: 'astra.yaml',
      organization_input_digest: 'analysis-react-groups',
    },
    groups: [{
      id: 'headline_figures',
      label: 'Headline figures',
      scope: 'root',
      kind: 'output',
      members: ['chart_a', 'chart_b'],
    }],
  };
  const html = renderToStaticMarkup(
    React.createElement('div', { className: 'astra-ui' },
      React.createElement(GraphExplorer, { model, organization }),
    ),
  );

  assert.match(html, /Headline figures: 2 grouped records/);
  assert.match(html, /astra-graph-node__group-mark/);
  assert.match(html, /astra-graph-node__mark--group-back/);
  assert.match(html, /astra-graph-node__mark--group-front/);
  assert.doesNotMatch(html, />2 output records<\/text>/);
  assert.doesNotMatch(html, /Group ·/);
  assert.doesNotMatch(html, /Collapse groups/);
});
