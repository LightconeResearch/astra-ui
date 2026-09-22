import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ResolvedAnalysisDocument, ResolvedOutput } from '@astra-spec/sdk';
import { indexAnalysis } from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../packages/react/src/primitives/index.js';
import { OutputDialog, PaperDetail } from '../../packages/react/src/components/index.js';
import { useDetailStack } from '../../packages/react/src/lib/index.js';
import { collectInventoryPapers } from '../../packages/react/src/model/papers.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;
const index = indexAnalysis(fixtureDocument);
const record = <T,>(path: string) => index.recordByPath.get(path) as T;

afterEach(cleanup);

describe('useDetailStack (controlled)', () => {
  it('proposes each change from the value the host rendered, never from an unaccepted proposal', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDetailStack({ value: [], onChange }));
    const a = { kind: 'record', canonicalPath: 'a', analysisPath: '$' } as const;
    const b = { kind: 'record', canonicalPath: 'b', analysisPath: '$' } as const;
    act(() => { result.current.push(a); });
    act(() => { result.current.push(b); });
    expect(onChange.mock.calls).toEqual([[[a]], [[b]]]);
    expect(result.current.stack).toEqual([]);
  });
});

describe('useOutputExpanded (controlled)', () => {
  it('asks the host to leave full screen when the record changes', () => {
    const onExpandedChange = vi.fn();
    const figure = record<ResolvedOutput>('outputs.headline');
    const other = record<ResolvedOutput>('clustering.outputs.correlation');
    const relations = { inputs: [], decisions: [] };
    const { rerender } = render(
      <OutputDialog record={figure} relations={relations} expanded onExpandedChange={onExpandedChange} onClose={() => undefined} />,
    );
    expect(onExpandedChange).not.toHaveBeenCalled();
    rerender(<OutputDialog record={other} relations={relations} expanded onExpandedChange={onExpandedChange} onClose={() => undefined} />);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });
});

describe('Slot prop merging', () => {
  it('keeps the slot\'s handler and attributes when the child sets them to undefined', () => {
    const onClick = vi.fn();
    render(<Button asChild onClick={onClick}><a href="/x" onClick={undefined}>Link</a></Button>);
    fireEvent.click(screen.getByRole('link', { name: 'Link' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    render(<Button asChild type="submit"><button type={undefined}>Go</button></Button>);
    expect(screen.getByRole('button', { name: 'Go' }).getAttribute('type')).toBe('submit');
  });
});

describe('PaperDetail decision filter', () => {
  it('narrows the insights to the one decision picked, and restores them', () => {
    const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis)[0];
    if (!paper) throw new Error('fixture paper missing');
    const onOpenInsight = vi.fn();
    render(<PaperDetail record={paper} onOpenInsight={onOpenInsight} />);

    const insights = () => screen.getAllByRole('button', { name: /^Open insight details/ });
    // Two insights on this paper, one of which no decision cites.
    expect(insights().length).toBe(2);

    const picker = screen.getByRole('combobox', { name: /Informs decision/ });
    fireEvent.change(picker, { target: { value: paper.decisions[0]?.canonicalPath } });
    expect((picker as HTMLSelectElement).value).toBe(paper.decisions[0]?.canonicalPath);
    expect(insights().length).toBe(1);

    // The claim is prose, not a control: only its name opens the insight.
    const [first] = insights();
    if (!first) throw new Error('no insight rendered');
    fireEvent.click(first);
    expect(onOpenInsight).toHaveBeenCalledTimes(1);

    fireEvent.change(picker, { target: { value: '' } });
    expect(insights().length).toBe(2);
    expect(screen.getByText('Insights from this paper')).toBeTruthy();
  });

  // The rail is one of the places a reader meets these records, so it carries
  // the same marks as everywhere else: the kind is readable at a glance here
  // too, not only where the record is named in full.
  it('marks every insight it lists and the decisions it filters by', () => {
    const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis)[0];
    if (!paper) throw new Error('fixture paper missing');
    const onOpenDecision = vi.fn();
    const { container } = render(<PaperDetail record={paper} onOpenDecision={onOpenDecision} />);

    const rows = [...container.querySelectorAll('.astra-paper-insight')];
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.querySelector('[data-slot="kind-glyph"][data-kind="prior_insight"]')).toBeTruthy();
    }

    const picker = screen.getByRole('combobox', { name: /Informs decision/ });
    expect(picker.parentElement?.querySelector('[data-slot="kind-glyph"][data-kind="decision"]')).toBeTruthy();

    // The open action belongs to the decision picked, and appears only once one is.
    expect(screen.queryByRole('button', { name: /^Open decision/ })).toBeNull();
    fireEvent.change(picker, { target: { value: paper.decisions[0]?.canonicalPath } });
    fireEvent.click(screen.getByRole('button', { name: /^Open decision/ }));
    expect(onOpenDecision).toHaveBeenCalledWith(paper.decisions[0]);
  });
});
