import { analysisAt } from '../helpers.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResolvedAnalysis, Insight, Output, Status } from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetailEntry } from '../../packages/react/src/lib/index.js';
import { Inventory } from '../../packages/react/src/views/index.js';
import { fixtureDocument as untypedFixture, fixtureStatus } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysis;

afterEach(cleanup);

const dialog = () => screen.getByRole('dialog', { hidden: true });

const rootInsight: DetailEntry = { kind: 'record', canonicalPath: 'prior_insights.published_method', analysisPath: '' };
/** Cited only by the root insight, so it is not among the `clustering` papers. */
const rootPaper: DetailEntry = { kind: 'paper', doi: 'https://doi.org/10.1234/EXAMPLE', analysisPath: '' };
const headline: DetailEntry = { kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '' };
const method: DetailEntry = { kind: 'record', canonicalPath: 'decisions.method', analysisPath: '' };

/** The fixture with the root analysis' `prior_insights` replaced. */
function withRootInsight(insight: Insight): ResolvedAnalysis {
  return {
    ...fixtureDocument,
    analyses: [{ ...analysisAt(fixtureDocument, 0), prior_insights: [insight] }, ...fixtureDocument.analyses.slice(1)],
  };
}

describe('Inventory analysis selection', () => {
  it('falls back to the root analysis when analysisPath is unknown', () => {
    render(<Inventory document={fixtureDocument} analysisPath="not.an.analysis" />);
    expect(screen.getByRole('button', { name: /Headline result/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Correlation function/ })).toBeNull();
    // The root's decision, not the nested analysis's; prior insights are no
    // longer a section, so they cannot witness which analysis is selected.
    expect(screen.getByRole('button', { name: /Method choice/ })).toBeTruthy();
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
    const withoutCitation = withRootInsight({
      ...(analysisAt(fixtureDocument, 0).prior_insights[0] as Insight),
      evidence: [],
    });
    rerender(
      <Inventory document={withoutCitation} detail={[rootInsight, rootPaper]} onDetailChange={onDetailChange} />,
    );
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

    const refreshed: ResolvedAnalysis = {
      ...fixtureDocument,
      analyses: [{ ...analysisAt(fixtureDocument, 0), decisions: [] }, ...fixtureDocument.analyses.slice(1)],
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

  it("keeps the persistent dialog when the active entry's analysis disappears", () => {
    const nested: DetailEntry = {
      kind: 'record',
      canonicalPath: 'clustering.outputs.correlation',
      analysisPath: 'clustering',
    };
    const onDetailChange = vi.fn();
    const { rerender } = render(
      <Inventory document={fixtureDocument} defaultDetail={[headline, nested]} onDetailChange={onDetailChange} />,
    );
    const element = dialog();
    const close = screen.getByRole('button', { name: 'Close output details' });
    expect(document.activeElement).toBe(close);

    const refreshed: ResolvedAnalysis = {
      ...fixtureDocument,
      analyses: [{ ...analysisAt(fixtureDocument, 0), declares: {} }],
    };
    rerender(<Inventory document={refreshed} defaultDetail={[headline, nested]} onDetailChange={onDetailChange} />);

    expect(onDetailChange.mock.calls).toEqual([[[headline]]]);
    expect(dialog()).toBe(element);
    expect(document.activeElement).toBe(close);
  });
});

describe('Insight source evidence', () => {
  const insightEntry: DetailEntry = { kind: 'record', canonicalPath: 'prior_insights.cited', analysisPath: '' };
  const baseInsight = {
    id: 'cited',
    kind: 'prior_insight',
    ref: 'prior_insights.cited',
    tags: [],
    claim: 'A cited claim.',
    created_at: '2026-01-01T00:00:00Z',
  } as const;

  it('skips a quote with no DOI so the passage shown and the paper opened come from the same entry', () => {
    const insight = {
      ...baseInsight,
      evidence: [
        { id: 'bare-quote', quote: { exact: 'A passage with no paper.' } },
        {
          id: 'cited-paper',
          doi: '10.1000/cited',
          quote: { exact: 'A passage from the cited paper.' },
          location: { value: 'page=7' },
        },
      ],
    } as unknown as Insight;
    const onDetailChange = vi.fn();
    render(
      <Inventory document={withRootInsight(insight)} defaultDetail={[insightEntry]} onDetailChange={onDetailChange} />,
    );

    expect(screen.getByText('A passage from the cited paper.')).toBeTruthy();
    expect(screen.queryByText('A passage with no paper.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Locate passage in paper/ }));
    expect(onDetailChange).toHaveBeenLastCalledWith([
      insightEntry,
      { kind: 'paper', doi: '10.1000/cited', analysisPath: '', focusInsightPath: 'prior_insights.cited' },
    ]);
  });

  it('shows no passage borrowed from an entry after the primary evidence', () => {
    const insight = {
      ...baseInsight,
      evidence: [
        { id: 'first', doi: '10.1000/first' },
        { id: 'second', doi: '10.1000/second', quote: { exact: 'A passage from the second paper.' } },
      ],
    } as unknown as Insight;
    const onDetailChange = vi.fn();
    render(
      <Inventory document={withRootInsight(insight)} defaultDetail={[insightEntry]} onDetailChange={onDetailChange} />,
    );

    // The primary evidence (first DOI) has no quote, so the popup shows no
    // passage and no locate affordance — never a later entry's passage.
    expect(screen.queryByText('A passage from the second paper.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Locate passage in paper/ })).toBeNull();

    // The paper itself stays reachable through the plain open action.
    fireEvent.click(screen.getByRole('button', { name: /Open source paper/ }));
    expect(onDetailChange).toHaveBeenLastCalledWith([
      insightEntry,
      { kind: 'paper', doi: '10.1000/first', analysisPath: '', focusInsightPath: 'prior_insights.cited' },
    ]);
  });
});

it('shows only exceptional materialization markers without output glyphs', () => {
  const statusFor = (output: Output): Status => ({
    state: output.type === 'figure' ? 'missing' : 'stale',
    why: [
      {
        code: 'DEMO',
        level: 'note',
        message: `Status for ${output.ref}`,
        location: { file: 'astra.yaml', pointer: '' },
        related: [],
      },
    ],
    stale_inputs: [],
  });
  const { rerender, container } = render(<Inventory document={fixtureDocument} getOutputStatus={statusFor} />);
  for (const output of analysisAt(fixtureDocument, 0).outputs) {
    if (output.type !== 'metric')
      expect(screen.getByRole('img', { name: new RegExp(`Status for ${output.ref}$`) })).toBeTruthy();
  }
  expect(screen.queryByText('Unchanged', { exact: true })).toBeNull();
  expect(
    container.querySelectorAll(
      '[data-slot="output-card"] [data-slot="kind-glyph"], [data-slot="output-entry"] [data-slot="kind-glyph"]',
    ),
  ).toHaveLength(0);
  rerender(<Inventory document={fixtureDocument} />);
  expect(container.querySelectorAll('.astra-output-status')).toHaveLength(0);
});

it('places the host code link beside Recipe in the selected output detail', () => {
  const open = vi.fn();
  const codedDocument = {
    ...fixtureDocument,
    results: fixtureDocument.results.map((result) => ({ ...result, command: 'python src/plot.py' })),
  };
  render(
    <Inventory
      document={codedDocument}
      defaultDetail={[headline]}
      renderCodeLink={(output) => <button onClick={() => open(output.ref)}>Open code</button>}
    />,
  );
  const link = screen.getByRole('button', { name: 'Open code' });
  expect(link.parentElement?.textContent).toContain('Recipe');
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith('outputs.headline');
});

it('switches universes locally and keeps controlled selection with the host', () => {
  const renderArtifact = vi.fn((output: Output, options: { result?: { id: string } | undefined }) => (
    <span>{options.result?.id}</span>
  ));
  const onUniverseChange = vi.fn();
  const view = render(
    <Inventory
      document={fixtureDocument}
      renderArtifact={renderArtifact}
      universeRef="universes.baseline"
      onUniverseChange={onUniverseChange}
    />,
  );
  expect(screen.getByText('outputs.headline#baseline')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Universe' }), { target: { value: 'universes.alternate' } });
  expect(onUniverseChange).toHaveBeenCalledWith('universes.alternate');
  expect(screen.getByText('outputs.headline#baseline')).toBeTruthy();
  view.rerender(
    <Inventory
      document={fixtureDocument}
      renderArtifact={renderArtifact}
      universeRef="universes.alternate"
      onUniverseChange={onUniverseChange}
    />,
  );
  expect(screen.getByText('outputs.headline#alternate')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Method choice, selected option Alternate/ })).toBeTruthy();
});
it('switches an uncontrolled universe without changing the report', () => {
  const renderArtifact = (_: Output, options: { result?: { id: string } | undefined }) => (
    <span>{options.result?.id}</span>
  );
  render(<Inventory document={fixtureDocument} renderArtifact={renderArtifact} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Universe' }), { target: { value: 'universes.alternate' } });
  expect(screen.getByText('outputs.headline#alternate')).toBeTruthy();
});

it('selects a driven child result in the root universe and does not leak baseline bytes into an inactive universe', () => {
  const child = analysisAt(fixtureDocument, 1);
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    results: [
      ...fixtureDocument.results.filter((result) => result.output !== 'clustering.outputs.correlation'),
      {
        id: 'root-owned-child-result',
        output: 'clustering.outputs.correlation',
        universe: 'universes.baseline',
        places: [],
        inputs: [],
      },
    ],
  };
  const renderArtifact = vi.fn(
    (_: Output, context: { result?: { id: string } | undefined; universeRef?: string | undefined }) => (
      <span>{context.result?.id ?? `inactive:${context.universeRef}`}</span>
    ),
  );
  render(<Inventory document={document} analysisPath={child.key} renderArtifact={renderArtifact} />);
  expect(screen.getByText('root-owned-child-result')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Universe' }), { target: { value: 'universes.alternate' } });
  expect(screen.getByText('inactive:universes.alternate')).toBeTruthy();
  expect(screen.queryByText('root-owned-child-result')).toBeNull();
});

it('keeps a pinned upstream universe when drilling into its output and decision', () => {
  const root = analysisAt(fixtureDocument);
  const downstream: Output = {
    ref: 'outputs.downstream',
    label: 'Downstream',
    type: 'data',
    format: 'json',
    tags: [],
    decisions: [],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [{ ...root, outputs: [...root.outputs, downstream] }, ...fixtureDocument.analyses.slice(1)],
    results: [
      ...fixtureDocument.results,
      {
        id: 'downstream',
        output: downstream.ref,
        universe: 'universes.baseline',
        command: 'python downstream.py',
        places: [],
        inputs: [{ entry: 'pinned authored input', result: 'outputs.headline#alternate' }],
      },
    ],
  };
  const onDetailChange = vi.fn();
  render(
    <Inventory
      document={document}
      defaultDetail={[{ kind: 'record', canonicalPath: downstream.ref, analysisPath: '' }]}
      onDetailChange={onDetailChange}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'View output: Headline result' }));
  expect(screen.getByText('python alternative.py')).toBeTruthy();
  expect(onDetailChange).toHaveBeenLastCalledWith([
    { kind: 'record', canonicalPath: downstream.ref, analysisPath: '' },
    { kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '', universeRef: 'universes.alternate' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'View decision: Method choice' }));
  const selected = screen.getByText('Selected').closest('li');
  expect(selected?.textContent).toContain('Alternate');
});

it('renders every effective finding citation with its own result, status and drilldown universe', () => {
  const root = analysisAt(fixtureDocument);
  const finding = {
    ...root.findings[0],
    ref: 'findings.headline_finding',
    kind: 'finding' as const,
    claim: 'The headline result is significant.',
    tags: [],
    evidence: [{ artifact: 'outputs.headline', cites: ['outputs.headline#baseline', 'outputs.headline#alternate'] }],
  };
  const document: ResolvedAnalysis = {
    ...fixtureDocument,
    analyses: [{ ...root, findings: [finding] }, ...fixtureDocument.analyses.slice(1)],
  };
  const renderArtifact = vi.fn((_: Output, context: { result?: { id: string } | undefined }) => (
    <span>{context.result?.id}</span>
  ));
  const onDetailChange = vi.fn();
  render(
    <Inventory
      document={document}
      statusReport={fixtureStatus}
      renderArtifact={renderArtifact}
      onDetailChange={onDetailChange}
      defaultDetail={[{ kind: 'record', canonicalPath: finding.ref, analysisPath: '' }]}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'View supporting result: Headline result (universes.baseline)' }),
  ).toBeTruthy();
  expect(renderArtifact).toHaveBeenCalledWith(
    expect.objectContaining({ ref: 'outputs.headline' }),
    expect.objectContaining({
      result: expect.objectContaining({ id: 'outputs.headline#alternate' }),
      status: fixtureStatus.statuses['outputs.headline#alternate'],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'View supporting result: Headline result (universes.alternate)' }),
  );
  expect(screen.getByText('python alternative.py')).toBeTruthy();
  expect(onDetailChange).toHaveBeenLastCalledWith([
    { kind: 'record', canonicalPath: finding.ref, analysisPath: '' },
    { kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '', universeRef: 'universes.alternate' },
  ]);
});
