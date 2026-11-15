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
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ ref: 'outputs.headline' }), analysisAt(document), undefined);
  expect(renderArtifact).toHaveBeenCalledWith(
    expect.objectContaining({ ref: 'outputs.headline' }),
    expect.objectContaining({ result: undefined }),
  );
});
