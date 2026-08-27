import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResolvedAnalysisDocument, ResolvedInsight } from '@astra-spec/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../packages/react/src/primitives/index.js';
import { AnalysisTree } from '../../packages/react/src/blocks/index.js';
import { InsightTrigger } from '../../packages/react/src/components/index.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;

afterEach(cleanup);

describe('Slot', () => {
  it('forwards both the slot ref and the child ref (development build)', () => {
    const slotRef = { current: null as HTMLButtonElement | null };
    const childRef = { current: null as HTMLAnchorElement | null };
    render(<Button asChild ref={slotRef}><a ref={childRef} href="/x">Link</a></Button>);
    const link = screen.getByRole('link', { name: 'Link' });
    expect(slotRef.current).toBe(link);
    expect(childRef.current).toBe(link);
  });
});

describe('host attributes merge instead of being overwritten', () => {
  it('lets a host aria-label name the analysis tree', () => {
    render(<AnalysisTree document={fixtureDocument} onSelectAnalysis={() => undefined} aria-label="Project map" />);
    expect(screen.getByRole('navigation', { name: 'Project map' })).toBeTruthy();
  });

  it('names the analysis tree by its heading when the host gives no label', () => {
    render(<AnalysisTree document={fixtureDocument} onSelectAnalysis={() => undefined} />);
    const heading = screen.getByRole('heading');
    expect(screen.getByRole('navigation', { name: heading.textContent ?? '' })).toBeTruthy();
  });

  it('runs the host onKeyDown first on the claim trigger and honours preventDefault', () => {
    const insight = fixtureDocument.analysis.prior_insights[0] as ResolvedInsight;
    const onOpen = vi.fn();
    const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => { if (event.key === ' ') event.preventDefault(); });
    render(<InsightTrigger insight={insight} variant="claim" onOpen={onOpen} onKeyDown={onKeyDown as never} />);
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
