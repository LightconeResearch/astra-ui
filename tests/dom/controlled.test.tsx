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
  it('narrows the insights to one decision and only then offers to open it', () => {
    const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis)[0];
    if (!paper) throw new Error('fixture paper missing');
    const onOpenDecision = vi.fn();
    render(<PaperDetail record={paper} onOpenDecision={onOpenDecision} />);

    expect(screen.queryByRole('button', { name: /^Open Method choice/ })).toBeNull();
    const chip = screen.getByRole('button', { name: 'Method choice' });
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Insights for Method choice')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Open Method choice/ }));
    expect(onOpenDecision).toHaveBeenCalledWith(paper.decisions[0]);

    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^Open Method choice/ })).toBeNull();
    expect(screen.getByText('Insights from this paper')).toBeTruthy();
  });
});
