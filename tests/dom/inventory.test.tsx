import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResolvedAnalysisDocument, ResolvedInsight } from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetailEntry } from '../../packages/react/src/components/index.js';
import { Inventory } from '../../packages/react/src/views/index.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;

afterEach(cleanup);

const dialog = () => screen.getByRole('dialog', { hidden: true });

const rootInsight: DetailEntry = { kind: 'record', canonicalPath: 'prior_insights.published_method', analysisPath: '$' };
/** Cited only by the root insight, so it is not among the `clustering` papers. */
const rootPaper: DetailEntry = { kind: 'paper', doi: 'https://doi.org/10.1234/EXAMPLE', analysisPath: '$' };
const headline: DetailEntry = { kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' };
const method: DetailEntry = { kind: 'record', canonicalPath: 'decisions.method', analysisPath: '$' };

/** The fixture with the root analysis' `prior_insights` replaced. */
function withRootInsight(insight: ResolvedInsight): ResolvedAnalysisDocument {
  return { ...fixtureDocument, analysis: { ...fixtureDocument.analysis, prior_insights: [insight] } };
}

describe('Inventory analysis selection', () => {
  it('falls back to the root analysis when analysisPath is unknown', () => {
    render(<Inventory document={fixtureDocument} analysisPath="not.an.analysis" />);
    expect(screen.getByRole('button', { name: /Headline result/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Correlation function/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Published method/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /nested_source/ })).toBeNull();
  });

  it('closes an uncontrolled stack exactly once when the analysis changes, without re-opening a survivor', () => {
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} defaultDetail={[rootInsight, rootPaper]} onDetailChange={onDetailChange} />,
    );
    expect(dialog().getAttribute('data-kind')).toBe('paper');
    expect(onDetailChange).not.toHaveBeenCalled();

    rerender(
      <Inventory
        document={fixtureDocument}
        analysisPath="clustering"
        defaultDetail={[rootInsight, rootPaper]}
        onDetailChange={onDetailChange}
      />,
    );
    expect(onDetailChange.mock.calls).toEqual([[[]]]);
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('leaves a controlled stack to the host when the analysis changes: entries resolve in their own analysis', () => {
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} detail={[rootInsight, rootPaper]} onDetailChange={onDetailChange} />,
    );
    expect(onDetailChange).not.toHaveBeenCalled();
    rerender(
      <Inventory
        document={fixtureDocument}
        analysisPath="clustering"
        detail={[rootInsight, rootPaper]}
        onDetailChange={onDetailChange}
      />,
    );
    // The root paper is not among clustering's papers, but the entry belongs to the root analysis, where it still resolves.
    expect(onDetailChange).not.toHaveBeenCalled();
    expect(dialog().getAttribute('data-kind')).toBe('paper');
  });

  it('prunes a controlled entry whose paper no longer exists anywhere', () => {
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} detail={[rootInsight, rootPaper]} onDetailChange={onDetailChange} />,
    );
    const withoutCitation = withRootInsight({ ...(fixtureDocument.analysis.prior_insights[0] as ResolvedInsight), evidence: [] });
    rerender(<Inventory document={withoutCitation} detail={[rootInsight, rootPaper]} onDetailChange={onDetailChange} />);
    expect(onDetailChange.mock.calls).toEqual([[[rootInsight]]]);
  });
});

describe('Inventory document refresh', () => {
  it('keeps the persistent dialog and its focus when the active entry stops resolving', () => {
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} defaultDetail={[headline, method]} onDetailChange={onDetailChange} />,
    );
    const element = dialog();
    expect(element.getAttribute('data-kind')).toBe('decision');
    const close = screen.getByRole('button', { name: 'Close decision details' });
    expect(document.activeElement).toBe(close);
    const closed = vi.fn();
    element.addEventListener('close', closed);

    const refreshed: ResolvedAnalysisDocument = {
      ...fixtureDocument,
      analysis: { ...fixtureDocument.analysis, decisions: [] },
    };
    rerender(<Inventory document={refreshed} defaultDetail={[headline, method]} onDetailChange={onDetailChange} />);

    expect(onDetailChange.mock.calls).toEqual([[[headline]]]);
    expect(dialog()).toBe(element);
    expect(element.hasAttribute('open')).toBe(true);
    expect(closed).not.toHaveBeenCalled();
    expect(element.getAttribute('data-kind')).toBe('output');
    expect(document.activeElement).toBe(close);
    expect(screen.getByRole('button', { name: 'Close output details' })).toBe(close);
  });

  it('keeps the persistent dialog when the active entry\'s analysis disappears', () => {
    const nested: DetailEntry = { kind: 'record', canonicalPath: 'clustering.outputs.correlation', analysisPath: 'clustering' };
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} defaultDetail={[headline, nested]} onDetailChange={onDetailChange} />,
    );
    const element = dialog();
    const close = screen.getByRole('button', { name: 'Close output details' });
    expect(document.activeElement).toBe(close);

    const refreshed: ResolvedAnalysisDocument = {
      ...fixtureDocument,
      analysis: { ...fixtureDocument.analysis, analyses: [] },
    };
    rerender(<Inventory document={refreshed} defaultDetail={[headline, nested]} onDetailChange={onDetailChange} />);

    expect(onDetailChange.mock.calls).toEqual([[[headline]]]);
    expect(dialog()).toBe(element);
    expect(document.activeElement).toBe(close);
  });
});

describe('Insight source evidence', () => {
  const insightEntry: DetailEntry = { kind: 'record', canonicalPath: 'prior_insights.cited', analysisPath: '$' };
  const baseInsight = {
    id: 'cited',
    kind: 'prior_insight',
    canonicalPath: 'prior_insights.cited',
    claim: 'A cited claim.',
    created_at: '2026-01-01T00:00:00Z',
  } as const;

  it('skips a quote with no DOI so the passage shown and the paper opened come from the same entry', () => {
    const insight = {
      ...baseInsight,
      evidence: [
        { id: 'bare-quote', quote: { exact: 'A passage with no paper.' } },
        { id: 'cited-paper', doi: '10.1000/cited', quote: { exact: 'A passage from the cited paper.' }, location: { page: 7 } },
      ],
    } as unknown as ResolvedInsight;
    const onDetailChange = vi.fn();
    render(<Inventory document={withRootInsight(insight)} defaultDetail={[insightEntry]} onDetailChange={onDetailChange} />);

    expect(screen.getByRole('button', { name: '10.1000/cited · page 7 ↗' })).toBeTruthy();
    expect(screen.getByText('A passage from the cited paper.')).toBeTruthy();
    expect(screen.queryByText('A passage with no paper.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Locate passage in paper/ }));
    expect(onDetailChange).toHaveBeenLastCalledWith([
      insightEntry,
      { kind: 'paper', doi: '10.1000/cited', analysisPath: '$', focusInsightPath: 'prior_insights.cited' },
    ]);
  });

  it('opens the first DOI and shows no passage borrowed from a later entry', () => {
    const insight = {
      ...baseInsight,
      evidence: [
        { id: 'first', doi: '10.1000/first' },
        { id: 'second', doi: '10.1000/second', quote: { exact: 'A passage from the second paper.' } },
      ],
    } as unknown as ResolvedInsight;
    const onDetailChange = vi.fn();
    render(<Inventory document={withRootInsight(insight)} defaultDetail={[insightEntry]} onDetailChange={onDetailChange} />);

    expect(screen.queryByText('A passage from the second paper.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Locate passage in paper/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '10.1000/first ↗' }));
    expect(onDetailChange).toHaveBeenLastCalledWith([
      insightEntry,
      { kind: 'paper', doi: '10.1000/first', analysisPath: '$', focusInsightPath: 'prior_insights.cited' },
    ]);
  });
});
