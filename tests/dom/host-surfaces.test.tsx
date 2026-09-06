import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { RecordDetails, type DetailEntry } from '../../packages/react/src/components/index.js';
import { fixtureDocument as fixture } from '../fixture.mjs';

const document = fixture as unknown as ResolvedAnalysisDocument;
afterEach(cleanup);

it('opens a standalone detail surface without an inventory layout, and keeps dismissal across refresh', () => {
  const detail: DetailEntry[] = [{ kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' }];
  const onChange = vi.fn();
  const { container, rerender } = render(<RecordDetails document={document} defaultDetail={detail} onDetailChange={onChange} />);
  expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
  expect(container.querySelector('[data-slot="inventory"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close output details' }));
  expect(onChange).toHaveBeenCalledWith([]);
  rerender(<RecordDetails document={{ ...document }} defaultDetail={detail} onDetailChange={onChange} />);
  expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
});

it('prunes a removed record in standalone details', () => {
  const detail: DetailEntry[] = [{ kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' }];
  const onChange = vi.fn();
  const { rerender } = render(<RecordDetails document={document} detail={detail} onDetailChange={onChange} />);
  rerender(<RecordDetails document={{ ...document, analysis: { ...document.analysis, outputs: [] } }} detail={detail} onDetailChange={onChange} />);
  expect(onChange).toHaveBeenCalledWith([]);
});
