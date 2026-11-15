import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { indexResolvedAnalysis, type Output, type ResolvedAnalysis } from '@astra-spec/sdk/reports';
import { afterEach, expect, it, vi } from 'vitest';
import { Inventory } from '../../packages/react/src/views/inventory.js';
import { RecordPreview } from '../../packages/react/src/components/record-preview.js';
import { fixtureDocument } from '../fixture.mjs';
import { analysisAt } from '../helpers.js';
afterEach(cleanup);
it('opens each option context when a result depends on two pins to the same output', () => {
  const root = analysisAt(fixtureDocument);
  const compare: Output = {
    ref: 'outputs.compare',
    label: 'Comparison',
    type: 'data',
    format: 'json',
    tags: [],
    decisions: [],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [{ ...root, outputs: [...root.outputs, compare] }, ...fixtureDocument.analyses.slice(1)],
    results: [
      ...fixtureDocument.results,
      {
        id: 'compare',
        output: compare.ref,
        universe: 'universes.baseline',
        places: [],
        inputs: [
          { entry: 'baseline input', result: 'outputs.headline#baseline' },
          { entry: 'alternate input', result: 'outputs.headline#alternate' },
        ],
      },
    ],
  };
  const view = render(
    <Inventory
      document={document}
      defaultDetail={[{ kind: 'record', canonicalPath: compare.ref, analysisPath: '' }]}
    />,
  );
  expect(screen.getByRole('button', { name: /^View decision: Method choice \(universes.baseline\)/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^View decision: Method choice \(universes.alternate\)/ }));
  expect(screen.getByText('Selected').closest('li')?.textContent).toContain('Alternate');
  fireEvent.click(screen.getByRole('button', { name: 'Back to previous record' }));
  fireEvent.click(screen.getByRole('button', { name: /^View decision: Method choice \(universes.baseline\)/ }));
  expect(screen.getByText('Selected').closest('li')?.textContent).toContain('Fiducial');
  view.unmount();
});
it('previews an unplanned output cited by its authored name, with no fabricated result', () => {
  const root = analysisAt(fixtureDocument),
    base = root.findings[0];
  if (!base) throw new Error('Fixture finding missing');
  const finding = { ...base, evidence: [{ artifact: 'headline', cites: [] }] };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [{ ...root, findings: [finding] }, ...fixtureDocument.analyses.slice(1)],
    results: fixtureDocument.results.filter((result) => result.output !== 'outputs.headline'),
  };
  const renderArtifact = vi.fn(() => null),
    open = vi.fn();
  render(
    <RecordPreview
      document={document}
      index={indexResolvedAnalysis(document)}
      entry={{ kind: 'record', record: finding, analysis: root }}
      renderArtifact={renderArtifact}
      onOpenRecord={open}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open output details: Headline result' }));
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({ ref: 'outputs.headline' }),
    analysisAt(document),
    undefined,
  );
  expect(renderArtifact).toHaveBeenCalledWith(
    expect.objectContaining({ ref: 'outputs.headline' }),
    expect.objectContaining({ result: undefined }),
  );
});

it('scopes once-built switch evidence by its evaluation binding in compact previews', () => {
  const root = analysisAt(fixtureDocument),
    base = root.findings[0];
  if (!base) throw new Error('Finding missing');
  const outputs: Output[] = ['a', 'b'].map((id) => ({
    ref: `outputs.fixed_${id}`,
    label: `Fixed ${id.toUpperCase()}`,
    type: 'figure',
    format: 'png',
    tags: [],
    decisions: [],
  }));
  const finding = {
    ...base,
    evidence: [
      {
        artifact: 'choice',
        cites: ['fixed-a', 'fixed-b'],
        bindings: [
          { universe: 'universes.baseline', output: 'outputs.fixed_a', result: 'fixed-a' },
          { universe: 'universes.alternate', output: 'outputs.fixed_b', result: 'fixed-b' },
        ],
      },
    ],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [
      { ...root, outputs: [...root.outputs, ...outputs], findings: [finding] },
      ...fixtureDocument.analyses.slice(1),
    ],
    results: [
      ...fixtureDocument.results,
      ...outputs.map((output, position) => ({
        id: position ? 'fixed-b' : 'fixed-a',
        output: output.ref,
        places: [],
        inputs: [],
      })),
    ],
  };
  const renderArtifact = vi.fn((_: Output, options: { result?: { id: string } | undefined }) => (
    <span>{options.result?.id}</span>
  ));
  const props = {
    document,
    index: indexResolvedAnalysis(document),
    entry: { kind: 'record' as const, record: finding, analysis: analysisAt(document) },
    renderArtifact,
  };
  const view = render(<RecordPreview {...props} universeRef="universes.baseline" />);
  expect(screen.getByText('fixed-a')).toBeTruthy();
  expect(screen.queryByText('fixed-b')).toBeNull();
  view.rerender(<RecordPreview {...props} universeRef="universes.alternate" />);
  expect(screen.getByText('fixed-b')).toBeTruthy();
  expect(screen.queryByText('fixed-a')).toBeNull();
});

it('shows authored dependencies and switch cases for an output without a planned result', () => {
  const root = analysisAt(fixtureDocument),
    base = root.outputs[1];
  if (!base) throw new Error('Output missing');
  const output = {
    ...base,
    inputs: [
      { entry: 'choice', target: 'switches.choice' },
      { entry: 'catalog', target: 'inputs.catalog' },
    ],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [
      {
        ...root,
        outputs: [root.outputs[0] as Output, output],
        switches: [
          {
            ref: 'switches.choice',
            decision: 'decisions.method',
            cases: {
              fiducial: { entry: 'headline', target: 'outputs.headline' },
              alternate: { entry: 'clustering.correlation', target: 'clustering.outputs.correlation' },
            },
          },
        ],
      },
      ...fixtureDocument.analyses.slice(1),
    ],
  };
  render(
    <Inventory document={document} defaultDetail={[{ kind: 'record', canonicalPath: output.ref, analysisPath: '' }]} />,
  );
  expect(screen.getByRole('heading', { name: /^Declared dependencies/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /^Switch switches.choice/ })).toBeTruthy();
  expect(screen.getByText('clustering.outputs.correlation')).toBeTruthy();
  expect(screen.getByText('Decision: decisions.method')).toBeTruthy();
});

it('keeps a no-case switch binding visible as unavailable evidence', () => {
  const root = analysisAt(fixtureDocument),
    base = root.findings[0];
  if (!base) throw new Error('Finding missing');
  const finding = {
    ...base,
    evidence: [{ artifact: 'choice', cites: [], bindings: [{ universe: 'universes.baseline' }] }],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [{ ...root, findings: [finding] }, ...fixtureDocument.analyses.slice(1)],
  };
  const renderArtifact = vi.fn(() => null);
  render(
    <RecordPreview
      document={document}
      index={indexResolvedAnalysis(document)}
      universeRef="universes.baseline"
      entry={{ kind: 'record', record: finding, analysis: analysisAt(document) }}
      renderArtifact={renderArtifact}
    />,
  );
  expect(screen.getByText('choice')).toBeTruthy();
  expect(renderArtifact).not.toHaveBeenCalled();
});
