import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ResolvedAnalysisDocument, ResolvedRecord } from '@astra-spec/sdk';
import { Inventory } from '../../packages/react/src/views/index.js';
import { fixtureDocument } from '../fixture.mjs';

afterEach(cleanup);

it('renders host actions for the current record and preserves output actions', () => {
  const onAttach = vi.fn();
  const document = fixtureDocument as ResolvedAnalysisDocument;
  const figure = document.analysis.outputs[0];
  const decision = document.analysis.decisions[0];
  if (!figure || !decision) throw new Error('Missing fixture records');
  const props = {
    document,
    detailMode: 'embedded' as const,
    renderRecordActions: (record: ResolvedRecord) => <button onClick={() => onAttach(record.canonicalPath)}>Add to chat</button>,
  };
  const { rerender } = render(<Inventory {...props} detail={[{ kind: 'record', canonicalPath: figure.canonicalPath, analysisPath: '$' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to chat' }));
  expect(onAttach).toHaveBeenLastCalledWith(figure.canonicalPath);
  expect(screen.getByRole('button', { name: 'View figure full screen' })).toBeTruthy();
  rerender(<Inventory {...props} detail={[{ kind: 'record', canonicalPath: decision.canonicalPath, analysisPath: '$' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add to chat' }));
  expect(onAttach).toHaveBeenLastCalledWith(decision.canonicalPath);
  rerender(<Inventory {...props} detail={[{ kind: 'record', canonicalPath: 'outputs.missing', analysisPath: '$' }]} />);
  expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull();
});
