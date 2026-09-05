import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PaperPdfViewer } from '../../packages/react/src/components/paper-pdf-viewer.js';
import type { PdfJs, PdfTextContent } from '../../packages/react/src/components/pdf-quote.js';

let intersections: { callback: IntersectionObserverCallback; elements: Element[] }[];
let scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();

beforeEach(() => {
  intersections = [];
  scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('IntersectionObserver', class {
    record: typeof intersections[number];
    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, elements: [] };
      intersections.push(this.record);
    }
    observe(element: Element) {
      this.record.elements.push(element);
      if ((element as HTMLElement).dataset.page === '1') {
        this.record.callback([{ target: element, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
    }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function runtime(texts = ['First page text', 'Second page text', 'The final scientific result']) {
  const rendered: number[] = [];
  const destroy = vi.fn(async () => {});
  const getText = vi.fn(async (n: number): Promise<PdfTextContent> => ({ items: [{ str: texts[n - 1] ?? '' }] }));
  const pdf = {
    numPages: texts.length,
    destroy,
    getPage: vi.fn(async (n: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: () => getText(n),
      render: () => { rendered.push(n); return { promise: Promise.resolve(), cancel: vi.fn() }; }
    }))
  };
  const getDocument = vi.fn(() => ({ promise: Promise.resolve(pdf), destroy }));
  class TextLayer {
    textDivs: HTMLElement[];
    textContentItemsStr: string[];
    constructor({ textContentSource, container }: { textContentSource: PdfTextContent; container: HTMLElement }) {
      this.textContentItemsStr = textContentSource.items.map(item => item.str ?? '');
      this.textDivs = this.textContentItemsStr.map(text => {
        const span = document.createElement('span');
        span.textContent = text;
        container.append(span);
        return span;
      });
    }
    render = async () => {};
    cancel = () => {};
  }
  const load = vi.fn(async () => ({ getDocument, TextLayer } as unknown as PdfJs));
  return { load, rendered, destroy, getDocument, getText, pdf };
}

it('lays out continuous pages and renders only pages near the viewport', async () => {
  const mock = runtime();
  const { container, unmount } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load} />);
  await waitFor(() => expect(mock.rendered).toEqual([1]));
  expect(container.querySelectorAll('[data-page]')).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Next PDF page' })).toBeNull();
  const second = container.querySelector('[data-page="2"]');
  if (!second) throw new Error('Second page was not mounted');
  act(() => {
    const observer = intersections.at(-1);
    if (!observer) throw new Error('Pages were not observed');
    observer.callback([{ target: second, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
  await waitFor(() => expect(mock.rendered).toEqual([1, 2]));
  expect(mock.load).toHaveBeenCalledTimes(1);
  unmount();
  expect(mock.destroy).toHaveBeenCalledTimes(1);
});

it('finds an offscreen quote, retains it through zoom, and ignores equivalent focus objects', async () => {
  const mock = runtime();
  const focus = { key: 'evidence', insightId: 'finding', quote: 'final scientific result', page: 3 };
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const { container, rerender } = render(<PaperPdfViewer {...props} focusRequest={focus} />);
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')?.textContent).toBe(focus.quote));
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  const calls = mock.getText.mock.calls.length;
  rerender(<PaperPdfViewer {...props} focusRequest={{ ...focus }} />);
  expect(mock.getText).toHaveBeenCalledTimes(calls);
  const width = (container.querySelector('[data-page="3"]') as HTMLElement).style.width;
  fireEvent.click(screen.getByRole('button', { name: 'Zoom PDF in' }));
  await waitFor(() => expect((container.querySelector('[data-page="3"]') as HTMLElement).style.width).not.toBe(width));
  await waitFor(() => expect(container.querySelector('[data-page="3"] mark')).toBeTruthy());
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  rerender(<PaperPdfViewer {...props} focusRequest={{ ...focus, key: 'locate-again' }} />);
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
});

it('falls back to the cited page when its quote cannot be found', async () => {
  const mock = runtime();
  const { container } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={mock.load}
    focusRequest={{ key: 'missing', insightId: 'finding', quote: 'Absent quotation altogether', page: 2 }} />);
  await screen.findByText('Exact quote not found; showing its cited page.');
  expect(mock.rendered).toContain(2);
  expect(container.querySelector('mark')).toBeNull();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it('does not start a PDF request when its runtime finishes loading after disposal', async () => {
  const mock = runtime();
  let finish!: (value: PdfJs) => void;
  const load = () => new Promise<PdfJs>(resolve => { finish = resolve; });
  const { unmount } = render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={load} />);
  unmount();
  await act(async () => { finish(await mock.load()); });
  expect(mock.getDocument).not.toHaveBeenCalled();
});

it('keeps a failed PDF usable through the host Open PDF fallback', async () => {
  const load = async (): Promise<PdfJs> => { throw new Error('Unavailable'); };
  render(<PaperPdfViewer pdfUrl="/paper.pdf" title="Paper" loadPdfJs={load} />);
  await screen.findByText('The PDF could not be loaded. Use “Open PDF” instead.');
});

it('cancels quote search when the focus is removed', async () => {
  const mock = runtime();
  let finish!: (value: PdfTextContent) => void;
  mock.getText.mockImplementation(async n => n === 3
    ? new Promise(resolve => { finish = resolve; })
    : { items: [{ str: 'Other text' }] });
  const props = { pdfUrl: '/paper.pdf', title: 'Paper', loadPdfJs: mock.load };
  const { container, rerender } = render(<PaperPdfViewer {...props}
    focusRequest={{ key: 'slow', insightId: 'finding', quote: 'final scientific result', page: 3 }} />);
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  rerender(<PaperPdfViewer {...props} />);
  await act(async () => { finish({ items: [{ str: 'final scientific result' }] }); });
  expect(container.querySelector('mark')).toBeNull();
  expect(scrollIntoView).not.toHaveBeenCalled();
  expect(screen.queryByText('Locating quote in the PDF…')).toBeNull();
});
