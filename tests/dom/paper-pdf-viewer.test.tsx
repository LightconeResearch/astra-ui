import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { indexAnalysis, type ResolvedAnalysisDocument } from '@astra-spec/sdk';
import { PaperPdfViewer } from '../../packages/react/src/components/paper-pdf-viewer.js';
import { PaperDialog } from '../../packages/react/src/components/paper-detail.js';
import { Inventory } from '../../packages/react/src/views/inventory.js';
import type { PdfJs, PdfTextContent } from '../../packages/react/src/components/pdf-runtime.js';
import { collectInventoryPapers, type PaperFocusEvidence } from '../../packages/react/src/model/papers.js';
import { fixtureDocument as fixture } from '../fixture.mjs';
import { mockPdfBrowser, runtime } from './pdf-test-runtime.js';
import { highlightMatch } from '../../packages/react/src/components/pdf-quote.js';

const document = fixture as unknown as ResolvedAnalysisDocument;
const index = indexAnalysis(document);
const metadata = { '10.1234/example': { pdfUrl: '/paper.pdf' } };
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}
const paper = required(collectInventoryPapers(document, index, document.analysis, metadata)[0]);
function focus(quote = 'The final scientific result is reproducible.', key = 'request', page?: number): PaperFocusEvidence {
  return { key, insight: required(paper.insights[0]), evidence: { id: 'source', quote: { exact: quote }, ...(page ? { location: { page } } : {}) } };
}
let browser: ReturnType<typeof mockPdfBrowser>;
beforeEach(() => { browser = mockPdfBrowser(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('highlights raw characters without interpreting quote text as HTML', () => {
  const div = window.document.createElement('span');
  const raw = 'Prefix <script>quoted</script> suffix';
  const mark = highlightMatch([raw], [div], '<script>quoted</script>');
  expect(mark?.textContent).toBe('<script>quoted</script>');
  expect(div.querySelector('script')).toBeNull();
  expect(div.textContent).toBe(raw);
});

it('releases a failed loading task immediately and does not destroy it twice', async () => {
  const mock = runtime();
  mock.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('Invalid PDF')), destroy: mock.destroy }));
  const { unmount } = render(<PaperPdfViewer pdfUrl="/bad.pdf" title="Paper" loadPdfJs={mock.load} />);
  await screen.findByText('The PDF could not be loaded.');
  expect(mock.destroy).toHaveBeenCalledTimes(1);
  unmount();
  expect(mock.destroy).toHaveBeenCalledTimes(1);
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

it('prefers a later complete quote to a partial match and keeps marks through zoom', async () => {
  const quote = 'A reproducible result appears on the final page.';
  const mock = runtime(['A reproducible result appears', 'Other text', quote]);
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const request = focus(quote);
  const { container, rerender } = render(<PaperPdfViewer {...props} focusEvidence={request} />);
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')?.textContent).toBe(quote));
  expect(screen.getByRole('status').textContent).toBe('Quote highlighted on page 3 of 3');
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  const calls = mock.getText.mock.calls.length;
  rerender(<PaperPdfViewer {...props} focusEvidence={{ ...request }} />);
  expect(mock.getText).toHaveBeenCalledTimes(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom PDF in' }));
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')?.textContent).toBe(quote));
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  rerender(<PaperPdfViewer {...props} focusEvidence={{ ...request, key: 'again' }} />);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(2));
});

it('labels partial matches and falls back to a valid cited page when no quote matches', async () => {
  const mock = runtime(['A reproducible result appears', 'Other text']);
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const { container, rerender } = render(<PaperPdfViewer {...props} focusEvidence={focus('A reproducible result appears in absent text')} />);
  await screen.findByText('Partial quote highlighted on page 1 of 2');
  rerender(<PaperPdfViewer {...props} focusEvidence={focus('Completely absent quotation', 'second', 2)} />);
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
  const { container, rerender } = render(<PaperPdfViewer {...props} focusEvidence={focus('The old passage', 'old', 2)} />);
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  rerender(<PaperPdfViewer {...props} focusEvidence={focus('The new passage', 'new', 3)} />);
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
  const props = { title: 'Paper', loadPdfJs: mock.load, focusEvidence: focus() };
  const { container, rerender } = render(<PaperPdfViewer {...props} pdfUrl="/first.pdf" />);
  await waitFor(() => expect(container.querySelector('mark')).toBeTruthy());
  const calls = mock.getText.mock.calls.length;
  rerender(<PaperPdfViewer {...props} pdfUrl="/second.pdf" />);
  await waitFor(() => expect(mock.getDocument).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(container.querySelector('mark')).toBeTruthy());
  expect(mock.destroy).toHaveBeenCalledTimes(1);
  expect(mock.getText.mock.calls.length).toBeGreaterThan(calls);
});

it('locates the initial insight and repeated rail requests through PaperDialog', async () => {
  const mock = runtime(['The fiducial method performs well.']);
  const props = { record: paper, loadPdfJs: mock.load, onClose: () => {}, focusInsight: paper.insights[0] };
  const { rerender } = render(<PaperDialog {...props} />);
  await waitFor(() => expect(browser.scroll).toHaveBeenCalledTimes(1));
  rerender(<PaperDialog {...props} metadata={{ status: 'fetching' }} />);
  expect(browser.scroll).toHaveBeenCalledTimes(1);
  const locate = required(screen.getAllByRole('button', { name: /Locate source passage/ })[0]);
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
