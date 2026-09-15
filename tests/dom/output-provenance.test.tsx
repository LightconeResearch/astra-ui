import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { Inventory } from '../../packages/react/src/views/index.js';
import { OutputProvenance, OutputStatusIndicator } from '../../packages/react/src/components/index.js';
import { fixtureDocument as untypedFixture } from '../fixture.mjs';

const document = untypedFixture as unknown as ResolvedAnalysisDocument;
afterEach(cleanup);

it('shows provenance below the recipe in the existing details list', () => {
  const fixture = {
    ...document,
    analysis: {
      ...document.analysis,
      outputs: document.analysis.outputs.map(output => ({ ...output, recipe: { command: 'python current.py' } })),
    },
  };
  const renderProvenance = vi.fn(() => <OutputProvenance status={{ state: 'unmaterialized' }} run={null} />);
  render(<Inventory document={fixture} renderProvenance={renderProvenance}
    renderArtifact={output => <img alt={output.id} src="plot.svg" />}
    defaultDetail={[{ kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' }]} />);
  const dialog = screen.getByRole('dialog', { hidden: true });
  expect(dialog.querySelector('img')).toBeTruthy();
  expect(screen.getByText('The primary result.')).toBeTruthy();
  expect(screen.getByText('No recorded run yet.')).toBeTruthy();
  expect(dialog.querySelector('[data-slot="output-provenance"]')?.previousElementSibling?.textContent).toContain('python current.py');
  expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
});

it('opens recorded metadata in a popup and closes only that popup', () => {
  const run = { finishedAt: '2026-09-15T10:00:00Z', gitRevision: 'abcdef0123456789', recipe: 'python original.py', environment: 'sha256:env', inputVersions: { catalog: 'sha256:data' }, cliVersion: '0.5' };
  render(<Inventory document={document}
    renderProvenance={() => <OutputProvenance status={{ state: 'outdated', detail: 'Input changed' }} run={run} />}
    defaultDetail={[{ kind: 'record', canonicalPath: 'outputs.headline', analysisPath: '$' }]} />);
  expect(screen.getByText('Status')).toBeTruthy();
  expect(screen.getByText('Out of date')).toBeTruthy();
  expect(screen.getByText('Last run')).toBeTruthy();
  expect(screen.getByText('Git revision')).toBeTruthy();
  expect(screen.queryByText('python original.py')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  const popup = screen.getByRole('dialog', { name: 'Run details', hidden: true });
  expect(popup.textContent).toContain('python original.py');
  expect(popup.textContent).toContain('sha256:data');
  expect(popup.textContent).toContain('sha256:env');
  expect(popup.textContent).toContain('0.5');
  fireEvent(popup, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Run details', hidden: true })).toBeNull();
  expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close run details' }));
  expect(screen.queryByRole('dialog', { name: 'Run details', hidden: true })).toBeNull();
  expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
});

it('does not label missing or failed metadata as a recorded success', () => {
  const view = render(<OutputProvenance />);
  expect(screen.getByText('Status unavailable')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Loading');
  view.rerender(<OutputProvenance error="Could not read record" />);
  expect(screen.getByRole('alert').textContent).toBe('Could not read record');
  expect(screen.queryByText('No recorded run yet.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
});

it('explains inventory status on hover, with a state-only fallback for missing reasons', () => {
  const view = render(<OutputStatusIndicator status={{ state: 'outdated', detail: '  the recipe changed  ' }} />);
  const marker = screen.getByRole('img', { name: 'Out of date: the recipe changed' });
  expect(marker.getAttribute('title')).toBe('Out of date: the recipe changed');
  view.rerender(<OutputStatusIndicator status={{ state: 'unmaterialized', detail: '   ' }} />);
  expect(screen.getByRole('img', { name: 'Not materialized' }).getAttribute('title')).toBe('Not materialized');
  view.rerender(<OutputStatusIndicator status={{ state: 'unmaterialized', detail: 'no manifest' }} />);
  expect(screen.getByRole('img', { name: 'Not materialized: no manifest' }).getAttribute('title')).toBe('Not materialized: no manifest');
});
