import { cleanup, render, screen } from '@testing-library/react';
import type { Output, Result, Status } from '@astra-spec/sdk/reports';
import { afterEach, expect, it, vi } from 'vitest';
import { OutputEntry } from '../../packages/react/src/components/output-entry.js';
import { OutputCard } from '../../packages/react/src/components/output-card.js';
const output: Output = {
  ref: 'outputs.samples',
  label: 'Effective samples',
  type: 'metric',
  format: 'json',
  tags: [],
  decisions: [],
};
const result: Result = {
  id: 'samples#baseline',
  output: output.ref,
  universe: 'universes.baseline',
  inputs: [],
  places: [],
};
const missing: Status = { state: 'missing', why: [], stale_inputs: [] };
afterEach(cleanup);
it('shows actual metric content even when no provenance record exists', () => {
  const renderArtifact = vi.fn(() => <strong>42</strong>);
  render(
    <OutputEntry
      output={output}
      result={result}
      universeRef={result.universe}
      status={missing}
      renderArtifact={renderArtifact}
      onOpen={() => undefined}
    />,
  );
  expect(screen.getByText('42')).toBeTruthy();
  expect(renderArtifact).toHaveBeenCalledWith(output, {
    compact: true,
    result,
    status: missing,
    universeRef: result.universe,
  });
  expect(screen.getByRole('button', { name: 'Open metric: Effective samples' }).textContent).not.toContain(
    'universes.baseline',
  );
});
it('prefers current host bytes when recorded content is absent, without changing provenance status', () => {
  const status: Status = { state: 'stale', bytes: { state: 'absent' }, why: [], stale_inputs: [] };
  const renderArtifact = vi.fn(() => <strong>43</strong>);
  const view = render(
    <OutputEntry
      output={output}
      result={result}
      status={status}
      renderArtifact={renderArtifact}
      onOpen={() => undefined}
    />,
  );
  expect(screen.getByText('43')).toBeTruthy();
  expect(screen.queryByLabelText('No value')).toBeNull();
  expect(screen.getByRole('img', { name: 'Stale: Recorded bytes are unavailable.' })).toBeTruthy();
  view.rerender(<OutputEntry output={output} result={result} status={status} onOpen={() => undefined} />);
  expect(screen.getByLabelText('No value')).toBeTruthy();
});
it('keeps compact card titles free of duplicated raw universe refs', () => {
  render(
    <OutputCard
      output={{ ...output, type: 'figure', format: 'png' }}
      result={result}
      renderArtifact={() => null}
      onOpen={() => undefined}
    />,
  );
  expect(screen.getByRole('button', { name: 'Open figure: Effective samples' }).textContent).not.toContain(
    'universes.baseline',
  );
});
