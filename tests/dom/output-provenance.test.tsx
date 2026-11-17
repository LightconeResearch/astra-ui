import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProvenanceRecord, Status } from '@astra-spec/sdk';
import { Inventory } from '../../packages/react/src/views/index.js';
import { OutputProvenance, OutputStatusIndicator } from '../../packages/react/src/components/index.js';
import { fixtureDocument } from '../fixture.mjs';
const status = (state: Status['state'], message?: string): Status => ({
  state,
  why: message
    ? [{ code: 'DEMO', level: 'note', message, location: { file: 'astra.yaml', pointer: '' }, related: [] }]
    : [],
  stale_inputs: [],
});
const record: ProvenanceRecord = {
  address: 'outputs.headline#baseline',
  spec_version: '0.1.0',
  content_hash: 'sha256:output',
  size: 128,
  generated_by: {
    commit: 'abcdef0123456789',
    finished: '2026-09-15T10:00:00Z',
    environment: { iri: 'sha256:env' },
    runner: { id: 'test-runner', version: '0.5' },
    inputs: [{ entry: 'inputs.catalog', content_hash: 'sha256:data', size: 64 }],
  },
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('shows native provenance below the effective command in the output details', () => {
  render(
    <Inventory
      document={fixtureDocument}
      renderProvenance={() => <OutputProvenance status={status('missing')} />}
      renderArtifact={(output) => <img alt={output.ref} src="plot.svg" />}
      defaultDetail={[{ kind: 'record', ref: 'outputs.headline', analysisKey: '' }]}
    />,
  );
  const dialog = screen.getByRole('dialog', { hidden: true });
  expect(dialog.querySelector('img')).toBeTruthy();
  expect(screen.getByText('The primary result.')).toBeTruthy();
  expect(screen.getByText('No recorded run yet.')).toBeTruthy();
  expect(dialog.querySelector('[data-slot="output-provenance"]')?.previousElementSibling?.textContent).toContain(
    'python plot.py',
  );
  expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
});
it('opens a public provenance record and closes only its metadata popup', () => {
  render(
    <Inventory
      document={fixtureDocument}
      renderProvenance={() => (
        <OutputProvenance status={{ ...status('stale', 'Input changed'), bytes: { state: 'absent' }, record }} />
      )}
      defaultDetail={[{ kind: 'record', ref: 'outputs.headline', analysisKey: '' }]}
    />,
  );
  expect(screen.getByText('Stale')).toBeTruthy();
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByText('Last run')).toBeTruthy();
  expect(screen.getByText('Git revision')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  const popup = screen.getByRole('dialog', { name: 'Run details', hidden: true });
  expect(popup.textContent).toContain('sha256:output');
  expect(popup.textContent).toContain('sha256:data');
  expect(popup.textContent).toContain('sha256:env');
  expect(popup.textContent).toContain('test-runner 0.5');
  fireEvent(popup, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Run details', hidden: true })).toBeNull();
  expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close run details' }));
  expect(screen.queryByRole('dialog', { name: 'Run details', hidden: true })).toBeNull();
});
it('keeps missing metadata and read errors distinct from success', () => {
  const view = render(<OutputProvenance />);
  expect(screen.getByText('Status unavailable')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
  view.rerender(<OutputProvenance error="Could not read record" />);
  expect(screen.getByRole('alert').textContent).toBe('Could not read record');
  expect(screen.queryByText('No recorded run yet.')).toBeNull();
});
it('explains report diagnostics in a tooltip and keeps byte absence separate from unchanged provenance', async () => {
  const user = userEvent.setup();
  const view = render(<OutputStatusIndicator status={status('stale', 'the recipe changed')} />);
  const marker = screen.getByRole('img', { name: 'Stale: the recipe changed' });
  await user.hover(marker);
  expect((await screen.findByRole('tooltip')).textContent).toBe('Stale: the recipe changed');
  view.rerender(<OutputStatusIndicator status={status('missing')} />);
  expect(screen.getByRole('tooltip').textContent).toBe('Missing');
  fireEvent.keyDown(globalThis.document, { key: 'Escape' });
  view.rerender(<OutputStatusIndicator status={status('unchanged')} />);
  expect(screen.queryByRole('img')).toBeNull();
  view.rerender(<OutputStatusIndicator status={{ ...status('unchanged'), bytes: { state: 'absent' } }} />);
  expect(screen.getByRole('img', { name: 'Unchanged: Recorded bytes are unavailable.' })).toBeTruthy();
});
