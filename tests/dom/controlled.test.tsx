import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ResolvedAnalysisDocument, ResolvedInsight, ResolvedOutput } from '@astra-spec/sdk';
import { indexAnalysis } from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../packages/react/src/primitives/index.js';
import { OutputDialog, PaperDetail, useDetailStack, type PaperRenderOptions } from '../../packages/react/src/components/index.js';
import { collectInventoryPapers } from '../../packages/react/src/model/index.js';
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

describe('PaperDetail focus requests', () => {
  it('keeps one focus object across unrelated re-renders and issues a new key per locate click', () => {
    const paper = collectInventoryPapers(fixtureDocument, index, fixtureDocument.analysis, { '10.1234/example': { pdfUrl: '/x.pdf' } })[0];
    if (!paper) throw new Error('fixture paper missing');
    const insight = record<ResolvedInsight>('prior_insights.published_method');
    const seen: (PaperRenderOptions['focusEvidence'])[] = [];
    const renderPaper = (_paper: unknown, options: PaperRenderOptions) => { seen.push(options.focusEvidence); return <div>paper</div>; };
    const { rerender } = render(<PaperDetail record={paper} focusInsight={insight} renderPaper={renderPaper} metadata={{ status: 'idle' }} />);
    rerender(<PaperDetail record={paper} focusInsight={insight} renderPaper={renderPaper} metadata={{ status: 'fetching' }} />);
    expect(seen[0]).toBeDefined();
    expect(seen[1]).toBe(seen[0]);
    expect(seen[0]?.key).toBe('prior_insights.published_method-source');

    const locate = screen.getAllByRole('button', { name: /Locate source passage/ })[0];
    if (!locate) throw new Error('no locate button');
    fireEvent.click(locate);
    fireEvent.click(locate);
    const keys = seen.map((focus) => focus?.key);
    const last = keys.at(-1);
    const previous = keys.at(-2);
    expect(last).not.toBe(previous);
    expect(seen.at(-1)?.evidence).toBe(seen.at(-2)?.evidence);
  });
});
