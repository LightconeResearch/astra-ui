import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { ResolvedOutput } from '@astra-spec/sdk';
import { OutputDetail } from '../../packages/react/src/components/index.js';
import { LabelsProvider } from '../../packages/react/src/lib/index.js';
import { fixtureDocument } from '../fixture.mjs';

afterEach(cleanup);

const figure = fixtureDocument.analysis.outputs[0] as ResolvedOutput;
const relations = { inputs: [], decisions: [] };
const renderArtifact = () => <img src="figure.png" alt="BAO fit" />;

it('magnifies a host figure within bounds, supports keyboard zoom, and resets to fit', () => {
  render(<OutputDetail record={figure} relations={relations} renderArtifact={renderArtifact} />);
  const zoomIn = screen.getByRole('button', { name: 'Zoom figure in' });
  const zoomOut = screen.getByRole('button', { name: 'Zoom figure out' }) as HTMLButtonElement;
  const viewport = screen.getByRole('region', { name: /^Figure preview/ });
  expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
  expect(zoomOut.disabled).toBe(false);
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
  fireEvent.click(zoomIn);
  expect(screen.queryByRole('button', { name: 'Fit figure' })).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  expect(zoomOut.getAttribute('aria-disabled')).toBeNull();
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1.25)');
  fireEvent.keyDown(viewport, { key: '+' });
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1.5)');
  fireEvent.keyDown(viewport, { key: '-', ctrlKey: true });
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1.5)');
  zoomIn.focus();
  for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(4)');
  // The press that reached the bound leaves the button focusable and focused.
  expect(zoomIn.getAttribute('aria-disabled')).toBe('true');
  expect((zoomIn as HTMLButtonElement).disabled).toBe(false);
  expect(document.activeElement).toBe(zoomIn);
  zoomOut.focus();
  for (let i = 0; i < 20; i++) fireEvent.click(zoomOut);
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
  expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(zoomOut);
  for (let i = 0; i < 4; i++) fireEvent.click(zoomIn);
  fireEvent.keyDown(viewport, { key: '0' });
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
  fireEvent.keyDown(viewport, { key: '-' });
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
});

it('resets zoom for another figure; tables keep their own scrolling', () => {
  const content = (record: ResolvedOutput) => (
    <OutputDetail record={record} relations={relations} renderArtifact={renderArtifact} />
  );
  const { rerender } = render(content(figure));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom figure in' }));
  rerender(content({ ...figure, canonicalPath: 'outputs.other' }));
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
  rerender(content({ ...figure, type: 'table' }));
  expect(screen.queryByRole('group', { name: 'Figure zoom' })).toBeNull();
});

it('uses host labels for the figure controls without changing the artifact renderer', () => {
  render(
    <LabelsProvider labels={{ figure: { zoomIn: 'Agrandir', zoomOut: 'Réduire' } }}>
      <OutputDetail record={figure} relations={relations} renderArtifact={renderArtifact} />
    </LabelsProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Agrandir' }));
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1.25)');
  expect(screen.getByRole('img', { name: 'BAO fit' }).getAttribute('src')).toBe('figure.png');
  fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
});
