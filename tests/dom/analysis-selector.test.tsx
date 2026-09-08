import { createRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { AnalysisSelector } from '../../packages/react/src/blocks/index.js';
import { LabelsProvider } from '../../packages/react/src/lib/index.js';
import { Inventory } from '../../packages/react/src/views/index.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const fixtureDocument = untypedFixture as unknown as ResolvedAnalysisDocument;
afterEach(cleanup);

it('opens by keyboard, focuses the selected analysis, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  const onSelectAnalysis = vi.fn();
  const outerKeyDown = vi.fn();
  render(
    <div onKeyDown={outerKeyDown}>
      <AnalysisSelector document={fixtureDocument} analysisPath="clustering" onSelectAnalysis={onSelectAnalysis} />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'Current analysis' });
  await user.tab();
  await user.keyboard('{Enter}');
  const popover = screen.getByRole('dialog', { name: 'Select an analysis' });
  expect(trigger.getAttribute('aria-controls')).toBe(popover.id);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clustering' }));
  outerKeyDown.mockClear();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(outerKeyDown).not.toHaveBeenCalled();
  expect(onSelectAnalysis).not.toHaveBeenCalled();
});

it('closes on outside pointer interaction, trigger toggle, and tabbing out', async () => {
  const user = userEvent.setup();
  render(<>
    <AnalysisSelector document={fixtureDocument} analysisPath="clustering" onSelectAnalysis={() => undefined} />
    <button type="button">Outside</button>
  </>);
  const trigger = screen.getByRole('button', { name: 'Current analysis' });
  await user.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(trigger);
  await user.click(trigger);
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(trigger);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('selects a child analysis in a host-composed inventory and closes its previous detail', async () => {
  const user = userEvent.setup();
  function Host() {
    const [path, setPath] = useState('$');
    return <>
      <AnalysisSelector document={fixtureDocument} analysisPath={path} onSelectAnalysis={setPath} />
      <Inventory document={fixtureDocument} analysisPath={path} detailMode="embedded" />
    </>;
  }
  render(<Host />);
  await user.click(screen.getByRole('button', { name: /Open figure: Headline result/ }));
  expect(screen.getByRole('button', { name: 'Close output details' })).toBeTruthy();
  const trigger = screen.getByRole('button', { name: 'Current analysis' });
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Clustering' }));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
  expect(screen.getByRole('button', { name: /Open table: Correlation function/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Open figure: Headline result/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close output details' })).toBeNull();
});

it('forwards host attributes and refs, localizes labels, and falls back to the first item for an unknown path', () => {
  const ref = createRef<HTMLDivElement>();
  render(
    <LabelsProvider labels={{ currentAnalysis: 'Analyse actuelle', selectAnalysis: 'Choisir une analyse' }}>
      <AnalysisSelector ref={ref} document={fixtureDocument} analysisPath="missing" onSelectAnalysis={() => undefined}
        className="host-selector" data-slot="host-picker" id="host-id" />
    </LabelsProvider>,
  );
  expect(ref.current?.id).toBe('host-id');
  expect(ref.current?.classList.contains('host-selector')).toBe(true);
  expect(ref.current?.getAttribute('data-slot')).toBe('host-picker');
  fireEvent.click(screen.getByRole('button', { name: 'Analyse actuelle' }));
  expect(screen.getByRole('dialog', { name: 'Choisir une analyse' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'DESI demo' }));
});
