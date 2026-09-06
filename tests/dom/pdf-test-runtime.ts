import { vi } from 'vitest';
import { textStrings } from '../../packages/react/src/components/pdf-quote.js';
import type { PdfJs, PdfTextContent, PdfTextLayerOptions } from '../../packages/react/src/components/pdf-runtime.js';

export function runtime(texts = ['An introductory result appears', 'An unrelated page', 'The final scientific result is reproducible.']) {
  const rendered: number[] = [];
  const destroy = vi.fn(async () => {});
  const cancel = vi.fn();
  const getText = vi.fn(async (n: number): Promise<PdfTextContent> => ({ items: [{ str: texts[n - 1] ?? '' }] }));
  const pdf = {
    numPages: texts.length,
    getPage: vi.fn(async (n: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: () => getText(n),
      render: () => { rendered.push(n); return { promise: Promise.resolve(), cancel }; },
    })),
  };
  const getDocument = vi.fn(() => ({ promise: Promise.resolve(pdf), destroy }));
  class TextLayer {
    readonly textContentItemsStr: string[];
    readonly textDivs: HTMLElement[];
    constructor({ textContentSource, container }: PdfTextLayerOptions) {
      this.textContentItemsStr = textStrings(textContentSource as PdfTextContent);
      this.textDivs = this.textContentItemsStr.map((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        container.append(span);
        return span;
      });
    }
    async render() {}
    cancel() { cancel(); }
  }
  const load = vi.fn(async (): Promise<PdfJs> => ({ getDocument, TextLayer }));
  return { load, rendered, destroy, cancel, getDocument, getText, pdf };
}

export function mockPdfBrowser() {
  const intersections: { callback: IntersectionObserverCallback; elements: Element[] }[] = [];
  const scroll = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
    if (!this.isConnected) throw new Error('Cannot locate a detached text span');
    scroll();
  });
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
    observe(element: Element) { this.record.elements.push(element); }
    disconnect() {}
  });
  return { intersections, scroll };
}
