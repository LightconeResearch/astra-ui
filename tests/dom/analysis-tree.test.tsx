import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResolvedAnalysisDocument, ResolvedAnalysisNode } from '@astra-spec/sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { AnalysisTree } from '../../packages/react/src/blocks/analysis-tree.js';
import { Inventory } from '../../packages/react/src/views/inventory.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixture = untypedFixture as unknown as ResolvedAnalysisDocument;
const child = fixture.analysis.analyses[0] as ResolvedAnalysisNode;
const document: ResolvedAnalysisDocument = {
  ...fixture,
  analysis: { ...fixture.analysis, analyses: [{
    ...child, id: 'clustering',
    analyses: [{ ...child, id: 'checks', name: 'Checks', canonicalPath: 'clustering.checks', outputs: [], prior_insights: [], analyses: [] }],
  }] },
};

afterEach(cleanup);

it('selects nested analyses by keyboard while keeping the whole hierarchy visible', async () => {
  const onSelectAnalysis = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(<AnalysisTree document={document} onSelectAnalysis={onSelectAnalysis} />);
  const checks = screen.getByRole('button', { name: 'Checks' });
  checks.focus();
  await user.keyboard('{Enter}');
  expect(onSelectAnalysis).toHaveBeenCalledWith('clustering.checks');
  rerender(<AnalysisTree document={document} analysisPath="clustering.checks" onSelectAnalysis={onSelectAnalysis} />);
  expect(checks.getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('button', { name: 'DESI demo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clustering' })).toBeTruthy();
});

it('puts controlled analysis navigation after the contents and updates the selected inventory', () => {
  const onSelectAnalysis = vi.fn();
  const { container, rerender } = render(<Inventory document={document} onSelectAnalysis={onSelectAnalysis} />);
  const sidebar = container.querySelector('.astra-inventory__sidebar') as HTMLElement;
  expect(sidebar.children[0]?.getAttribute('data-slot')).toBe('inventory-outline');
  expect(sidebar.children[1]?.getAttribute('data-slot')).toBe('analysis-tree');
  fireEvent.click(within(sidebar).getByRole('button', { name: 'Clustering' }));
  expect(onSelectAnalysis).toHaveBeenCalledWith('clustering');
  expect(screen.getByRole('button', { name: /Headline result/ })).toBeTruthy();
  rerender(<Inventory document={document} analysisPath="clustering" onSelectAnalysis={onSelectAnalysis} />);
  expect(screen.queryByRole('button', { name: /Headline result/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Correlation function/ })).toBeTruthy();
  expect(within(sidebar).getByRole('button', { name: 'Clustering' }).getAttribute('aria-current')).toBe('page');
});

it('keeps navigation available without the contents and handles a single analysis', () => {
  const single = { ...fixture, analysis: { ...fixture.analysis, analyses: [] } };
  render(<Inventory document={single} showOutline={false} onSelectAnalysis={vi.fn()} />);
  expect(screen.queryByLabelText('On this page')).toBeNull();
  const nav = screen.getByRole('navigation', { name: 'ASTRA project' });
  expect(within(nav).getAllByRole('button')).toHaveLength(1);
  expect(within(nav).getByRole('button', { name: 'DESI demo' }).getAttribute('aria-current')).toBe('page');
});
