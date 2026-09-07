import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { indexAnalysis, type ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { PaperPdfViewer, type PdfLoadState, type PdfPassage } from '../../packages/react/src/components/paper-pdf-viewer.js';
import { PaperDialog } from '../../packages/react/src/components/paper-detail.js';
import { Inventory } from '../../packages/react/src/views/inventory.js';
import type { PdfJs, PdfTextContent } from '../../packages/react/src/components/pdf-runtime.js';
import { collectInventoryPapers } from '../../packages/react/src/model/papers.js';
import { fixtureDocument as fixture } from '../fixture.mjs';
import { mockPdfBrowser, runtime } from './pdf-test-runtime.js';
import { LabelsProvider } from '../../packages/react/src/lib/labels.js';
import { findQuoteMatch, highlightMatch } from '../../packages/react/src/components/pdf-quote.js';

const document = fixture as unknown as ResolvedAnalysisDocument;
const index = indexAnalysis(document);
const metadata = { '10.1234/example': { pdfUrl: '/paper.pdf' } };
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}
const paper = required(collectInventoryPapers(document, index, document.analysis, metadata)[0]);
function passage(quote = 'The final scientific result is reproducible.', key = 'request', page?: number): PdfPassage {
  return { key, quote, page };
}
let browser: ReturnType<typeof mockPdfBrowser>;
beforeEach(() => { browser = mockPdfBrowser(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('highlights raw characters without interpreting quote text as HTML', () => {
  const div = window.document.createElement('span');
  const raw = 'Prefix <script>quoted</script> suffix';
  const mark = highlightMatch([raw], [div], required(findQuoteMatch([raw], '<script>quoted</script>')));
  expect(mark?.textContent).toBe('<script>quoted</script>');
  expect(div.querySelector('script')).toBeNull();
  expect(div.textContent).toBe(raw);
});

it('releases a failed loading task immediately, reports the reason once, and does not destroy it twice', async () => {
  const mock = runtime();
  const reason = new Error('Invalid PDF');
  mock.getDocument.mockImplementation(() => ({ promise: Promise.reject(reason), destroy: mock.destroy }));
  const reports: [PdfLoadState, unknown][] = [];
  const { unmount } = render(<PaperPdfViewer pdfUrl="/bad.pdf" title="Paper" loadPdfJs={mock.load}
    onLoadStateChange={(state, error) => reports.push([state, error])} />);
  await screen.findByText('The PDF could not be loaded.');
  expect(mock.destroy).toHaveBeenCalledTimes(1);
  expect(reports).toEqual([['loading', undefined], ['error', reason]]);
  unmount();
  expect(mock.destroy).toHaveBeenCalledTimes(1);
});

it('loads once per document however often the host re-creates its callbacks', async () => {
  const mock = runtime();
  const reports: PdfLoadState[] = [];
  const content = () => (
    <PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={() => mock.load()}
      onLoadStateChange={(state) => reports.push(state)} />
  );
  const { rerender } = render(content());
  await screen.findByText('3 pages');
  rerender(content());
  rerender(content());
  expect(mock.getDocument).toHaveBeenCalledTimes(1);
  expect(reports).toEqual(['loading', 'ready']);
  expect(screen.getByRole('status').textContent).toBe('3 pages');
});

it('renders nearby pages, frees canvases outside that region, and renders them again on return', async () => {
  const mock = runtime();
  const { container, unmount } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load} />);
  await waitFor(() => expect(mock.rendered).toEqual([1]));
  expect(container.querySelectorAll('[data-page]')).toHaveLength(3);
  const second = required(container.querySelector('[data-page="2"]'));
  const observer = required(browser.intersections.find((record) => record.elements.includes(second)));
  const intersect = (visible: boolean) => act(() => observer.callback(
    [{ target: second, isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver,
  ));
  intersect(true);
  await waitFor(() => expect(mock.rendered).toEqual([1, 2]));
  const canvas = required(second.querySelector('canvas'));
  expect(canvas.width).toBeGreaterThan(0);
  intersect(false);
  expect(canvas.width).toBe(0);
  expect(second.querySelector('span')).toBeNull();
  intersect(true);
  await waitFor(() => expect(mock.rendered).toEqual([1, 2, 2]));
  unmount();
  expect(mock.destroy).toHaveBeenCalledTimes(1);
});

it('keeps the canvas backing store within the per-canvas limit of every supported browser', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(6000);
  const mock = runtime();
  const { container } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load} />);
  await waitFor(() => expect(mock.rendered).toEqual([1]));
  const canvas = required(container.querySelector<HTMLCanvasElement>('[data-page="1"] canvas'));
  const pixels = canvas.width * canvas.height;
  expect(pixels).toBeGreaterThan(16_000_000);
  expect(pixels).toBeLessThanOrEqual(16_777_216);
});

it('prefers a later complete quote to a partial match and keeps marks through zoom', async () => {
  const quote = 'A reproducible result appears on the final page.';
  const mock = runtime(['A reproducible result appears', 'Other text', quote]);
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const request = passage(quote);
  const { container, rerender } = render(<PaperPdfViewer {...props} passage={request} />);
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')?.textContent).toBe(quote));
  expect(screen.getByRole('status').textContent).toBe('Quote highlighted on page 3 of 3');
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  const calls = mock.getText.mock.calls.length;
  rerender(<PaperPdfViewer {...props} passage={{ ...request }} />);
  expect(mock.getText).toHaveBeenCalledTimes(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom PDF in' }));
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')?.textContent).toBe(quote));
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  // Every page's text is extracted once; zoom rebuilds the layer from the cache.
  expect(mock.getText).toHaveBeenCalledTimes(3);
  rerender(<PaperPdfViewer {...props} passage={{ ...request, key: 'again' }} />);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(2));
});

it('labels partial matches and falls back to a valid cited page when no quote matches', async () => {
  const mock = runtime(['A reproducible result appears', 'Other text']);
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const { container, rerender } = render(<PaperPdfViewer {...props} passage={passage('A reproducible result appears in absent text')} />);
  await screen.findByText('Partial quote highlighted on page 1 of 2');
  rerender(<PaperPdfViewer {...props} passage={passage('Completely absent quotation', 'second', 2)} />);
  await screen.findByText('Exact quote not found; showing cited page 2 of 2');
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(2));
  expect(container.querySelector('mark')).toBeNull();
});

it('discards a slow search when another passage is requested', async () => {
  const mock = runtime();
  let finish!: (value: PdfTextContent) => void;
  mock.getText.mockImplementation(async (n) => n === 2
    ? new Promise((resolve) => { finish = resolve; })
    : { items: [{ str: n === 3 ? 'The new passage' : 'Other text' }] });
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const { container, rerender } = render(<PaperPdfViewer {...props} passage={passage('The old passage', 'old', 2)} />);
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  rerender(<PaperPdfViewer {...props} passage={passage('The new passage', 'new', 3)} />);
  await waitFor(() => expect(container.querySelector('mark')?.textContent).toBe('The new passage'));
  await act(async () => { finish({ items: [{ str: 'The old passage' }] }); });
  expect(container.querySelector('mark')?.textContent).toBe('The new passage');
});

it('does not open a document after disposal while its runtime is loading', async () => {
  const mock = runtime();
  let finish!: (value: PdfJs) => void;
  const load = () => new Promise<PdfJs>((resolve) => { finish = resolve; });
  const { unmount } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={load} />);
  unmount();
  await act(async () => { finish(await mock.load()); });
  expect(mock.getDocument).not.toHaveBeenCalled();
});

it('destroys the previous document and resets its cache on a URL change', async () => {
  const mock = runtime();
  const props = { title: 'Paper', loadPdfJs: mock.load, passage: passage() };
  const { container, rerender } = render(<PaperPdfViewer {...props} pdfUrl="/first.pdf" />);
  await waitFor(() => expect(container.querySelector('mark')).toBeTruthy());
  const calls = mock.getText.mock.calls.length;
  rerender(<PaperPdfViewer {...props} pdfUrl="/second.pdf" />);
  await waitFor(() => expect(mock.getDocument).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(container.querySelector('mark')).toBeTruthy());
  expect(mock.destroy).toHaveBeenCalledTimes(1);
  expect(mock.getText.mock.calls.length).toBeGreaterThan(calls);
});

it('survives StrictMode double effects: one document, one raster per page, one scroll, one release', async () => {
  const mock = runtime();
  const reports: PdfLoadState[] = [];
  const { container, unmount } = render(
    <StrictMode>
      <PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load} passage={passage()}
        onLoadStateChange={(state) => reports.push(state)} />
    </StrictMode>,
  );
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')).toBeTruthy());
  expect(mock.getDocument).toHaveBeenCalledTimes(1);
  expect(mock.rendered).toEqual([1, 3]);
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  expect(reports.filter((state) => state === 'ready')).toHaveLength(1);
  unmount();
  expect(mock.destroy).toHaveBeenCalledTimes(1);
});

it('locates the initial insight and repeated rail requests through PaperDialog', async () => {
  const mock = runtime(['The fiducial method performs well.']);
  const props = { record: paper, loadPdfJs: mock.load, onClose: () => {}, focusInsight: paper.insights[0] };
  const { rerender } = render(<PaperDialog {...props} />);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(1));
  rerender(<PaperDialog {...props} metadata={{ status: 'fetching' }} />);
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  const locate = required(screen.getAllByRole('button', { name: /Locate source passage/ })[0]);
  expect(locate.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(locate);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(2));
  fireEvent.click(locate);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(3));
  expect(mock.load).toHaveBeenCalledTimes(1);
});

it('routes external opening through Inventory while keeping the action usable after PDF load failure', async () => {
  const load = vi.fn(async (): Promise<PdfJs> => { throw new Error('Unavailable'); });
  const open = vi.fn();
  render(<Inventory document={document} paperMetadata={metadata} loadPdfJs={load} onOpenPaperFile={open}
    defaultDetail={[{ kind: 'paper', doi: paper.doi, analysisPath: '$' }]} />);
  await screen.findByText('The PDF could not be loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ doi: paper.doi, pdfUrl: '/paper.pdf' }));
  expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
});

it('announces a single page in the singular', async () => {
  const mock = runtime(['Only page']);
  render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load} />);
  await screen.findByText('1 page');
});

const pdfLabels = {
  loading: 'Chargement…',
  loadError: 'Lecture impossible.',
  unavailable: 'Aperçu indisponible.',
  searching: 'Recherche…',
  quoteNotFound: 'Citation introuvable.',
  pages: 'Pages du document',
  zoomIn: 'Agrandir',
  zoomOut: 'Réduire',
  zoomLevel: (percent: number) => `Échelle ${percent}`,
  viewer: (title: string) => `Lecteur : ${title}`,
  page: (page: number) => `Feuille ${page}`,
  pageError: (page: number) => `Erreur feuille ${page}`,
  pageCount: (count: number) => `${count} feuilles`,
  quoteHighlighted: (page: number, count: number) => `Citation ${page}/${count}`,
  partialQuoteHighlighted: (page: number, count: number) => `Extrait ${page}/${count}`,
  citedPageFallback: (page: number, count: number) => `Page citée ${page}/${count}`,
  locatePassage: (passage: number) => `Trouver le passage ${passage}`,
};

it.each([
  [undefined, '3 feuilles'],
  [passage(), 'Citation 3/3'],
  [passage('The final scientific result is reproducible. An absent continuation.'), 'Extrait 3/3'],
  [passage('Completely absent quotation', 'fallback', 2), 'Page citée 2/3'],
  [passage('Completely absent quotation'), 'Citation introuvable.'],
] as const)('uses localized PDF statuses and accessible names for request %j', async (request, expected) => {
  const mock = runtime();
  render(<LabelsProvider labels={{ pdf: pdfLabels }}>
    <PaperPdfViewer pdfUrl="/paper.pdf" title="Article" loadPdfJs={mock.load} passage={request} />
  </LabelsProvider>);
  expect(screen.getByText('Chargement…')).toBeTruthy();
  await screen.findByText(expected);
  expect(screen.getByRole('group', { name: 'Lecteur : Article' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Pages du document' })).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Feuille 1' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Agrandir' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Réduire' })).toBeTruthy();
  expect(screen.getByText('Échelle 100')).toBeTruthy();
});

it('inherits PDF labels in paper dialogs, localizes loading, errors and unavailable content, and makes locating inert after a failure', async () => {
  const load = vi.fn(async (): Promise<PdfJs> => { throw new Error('Missing runtime'); });
  const content = (loader?: () => Promise<PdfJs>) => <LabelsProvider labels={{ pdf: pdfLabels }}>
    <LabelsProvider labels={{ pdf: { loading: undefined } }}>
      <PaperDialog record={paper} loadPdfJs={loader} onClose={() => {}} />
    </LabelsProvider>
  </LabelsProvider>;
  const { rerender } = render(content(load));
  expect(screen.getByText('Chargement…')).toBeTruthy();
  await screen.findByText('Lecture impossible.');
  const locate = screen.getByRole('button', { name: 'Trouver le passage 1' });
  await waitFor(() => expect(locate.getAttribute('aria-disabled')).toBe('true'));
  fireEvent.click(locate);
  expect(screen.getByText('Lecture impossible.')).toBeTruthy();
  rerender(content());
  expect(screen.getByText('Aperçu indisponible.')).toBeTruthy();
});

it('updates localized search results without restarting search or loading the document', async () => {
  const mock = runtime();
  let finish!: (value: PdfTextContent) => void;
  mock.getText.mockImplementation(async (n) => n === 3
    ? new Promise((resolve) => { finish = resolve; })
    : { items: [{ str: 'Other text' }] });
  const request = passage();
  const content = (labels = pdfLabels) => <LabelsProvider labels={{ pdf: labels }}>
    <PaperPdfViewer pdfUrl="/paper.pdf" title="Article" loadPdfJs={mock.load} passage={request} />
  </LabelsProvider>;
  const { rerender } = render(content());
  await screen.findByText('Recherche…');
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  await act(async () => { finish({ items: [{ str: 'The final scientific result is reproducible.' }] }); });
  await screen.findByText('Citation 3/3');
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(1));
  const calls = mock.getText.mock.calls.length;
  rerender(content({ ...pdfLabels, quoteHighlighted: (page, total) => `Citation traduite ${page}/${total}` }));
  expect(screen.getByText('Citation traduite 3/3')).toBeTruthy();
  expect(mock.getText).toHaveBeenCalledTimes(calls);
  expect(mock.load).toHaveBeenCalledTimes(1);
});

it('localizes page render failures and updates them when labels change', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const mock = runtime();
  const content = (pageError = pdfLabels.pageError) => <LabelsProvider labels={{ pdf: { ...pdfLabels, pageError } }}>
    <PaperPdfViewer pdfUrl="/paper.pdf" title="Article" loadPdfJs={mock.load} />
  </LabelsProvider>;
  const { rerender } = render(content());
  await screen.findByText('Erreur feuille 1');
  rerender(content((page) => `Erreur traduite ${page}`));
  expect(screen.getByText('Erreur traduite 1')).toBeTruthy();
  expect(mock.load).toHaveBeenCalledTimes(1);
});
