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
  render(<OutputDetail record={figure} relations={relations} renderArtifact={renderArtifact} expanded />);
  const zoomIn = screen.getByRole('button', { name: 'Zoom figure in' });
  const zoomOut = screen.getByRole('button', { name: 'Zoom figure out' }) as HTMLButtonElement;
  const viewport = screen.getByRole('region', { name: /^Figure preview/ });
  expect(zoomOut.disabled).toBe(true);
  expect(screen.getByText('100%')).toBeTruthy();
  fireEvent.click(zoomIn);
  expect(screen.getByText('125%')).toBeTruthy();
  expect(zoomOut.disabled).toBe(false);
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1.25)');
  fireEvent.keyDown(viewport, { key: '+' });
  expect(screen.getByText('150%')).toBeTruthy();
  fireEvent.keyDown(viewport, { key: '-', ctrlKey: true });
  expect(screen.getByText('150%')).toBeTruthy();
  for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
  expect(screen.getByText('400%')).toBeTruthy();
  expect((zoomIn as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Fit figure' }));
  expect(screen.getByText('100%')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'BAO fit' }).closest('.astra-figure-zoom__canvas')?.getAttribute('style')).toContain('scale(1)');
  fireEvent.keyDown(viewport, { key: '-' });
  expect(screen.getByText('100%')).toBeTruthy();
});

it('resets zoom for another figure and on reopening full screen; tables keep their own scrolling', () => {
  const content = (record: ResolvedOutput, expanded = true) => (
    <OutputDetail record={record} relations={relations} renderArtifact={renderArtifact} expanded={expanded} />
  );
  const { rerender } = render(content(figure));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom figure in' }));
  rerender(content({ ...figure, canonicalPath: 'outputs.other' }));
  expect(screen.getByText('100%')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Zoom figure in' }));
  rerender(content(figure, false));
  expect(screen.queryByRole('group', { name: 'Figure zoom' })).toBeNull();
  rerender(content(figure));
  expect(screen.getByText('100%')).toBeTruthy();
  rerender(content({ ...figure, type: 'table' }));
  expect(screen.queryByRole('group', { name: 'Figure zoom' })).toBeNull();
});

it('uses host labels for the figure controls without changing the artifact renderer', () => {
  render(
    <LabelsProvider labels={{ figure: { zoomIn: 'Agrandir', fit: 'Ajuster', zoomLevel: (percent) => `Échelle ${percent}` } }}>
      <OutputDetail record={figure} relations={relations} renderArtifact={renderArtifact} expanded />
    </LabelsProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Agrandir' }));
  expect(screen.getByText('Échelle 125')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'BAO fit' }).getAttribute('src')).toBe('figure.png');
  fireEvent.click(screen.getByRole('button', { name: 'Ajuster' }));
  expect(screen.getByText('Échelle 100')).toBeTruthy();
});
