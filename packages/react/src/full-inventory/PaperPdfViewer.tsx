import { useEffect, useRef, useState } from 'react';

interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

interface PdfTextContent {
  items: Array<{ str?: string }>;
}

interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PdfPageProxy {
  getTextContent: () => Promise<PdfTextContent>;
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: Record<string, unknown>) => PdfRenderTask;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

interface PdfLoadingTask {
  promise: Promise<PDFDocumentProxy>;
  destroy: () => Promise<void>;
}

interface PdfTextLayer {
  render: () => Promise<void>;
  cancel: () => void;
  textDivs: HTMLElement[];
  textContentItemsStr: string[];
}

interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { url: string }) => PdfLoadingTask;
  TextLayer: new (options: {
    textContentSource: PdfTextContent;
    container: HTMLElement;
    viewport: PdfViewport;
  }) => PdfTextLayer;
}

function pdfAssetUrl(baseurl: string, filename: string): string {
  return `${baseurl.replace(/\/+$/, '')}/${filename}`;
}

function withoutFragment(url: string): string {
  return url.split('#')[0] ?? url;
}

function loadPdfJs(baseurl: string): Promise<PdfJs> {
  // The host serves this module at runtime; bundlers must not turn the URL into
  // a compile-time module-context lookup.
  return import(
    /* webpackIgnore: true */
    pdfAssetUrl(baseurl, 'pdf.mjs')
  ) as Promise<PdfJs>;
}

export interface PaperQuoteFocusRequest {
  key: string;
  insightId: string;
  quote: string;
  page?: number | undefined;
}

export interface PaperPdfViewerProps {
  pdfUrl: string;
  title: string;
  focusRequest?: PaperQuoteFocusRequest | undefined;
  /**
   * Host-provided directory containing pdf.mjs and pdf.worker.min.mjs.
   */
  pdfAssetBaseUrl: string;
}

interface MatchOrigin {
  itemIndex: number;
  rawStart: number;
  rawEnd: number;
}

interface QuoteMatch {
  origin: MatchOrigin[];
  start: number;
  length: number;
}

const ZOOM_LEVELS = [0.8, 1, 1.25, 1.5, 2];

function normalizeChar(character: string): string {
  if (character === '\u00ad' || '-‐‑‒–—―'.includes(character)) return '';
  if ('‘’‚‛'.includes(character)) return "'";
  if ('“”„‟'.includes(character)) return '"';
  return character.toLowerCase();
}

function normalizeQuote(value: string): { aggressive: string; withSpaces: string } {
  let aggressive = '';
  let withSpaces = '';
  for (const character of value.normalize('NFKC')) {
    if (/\s/.test(character)) {
      if (withSpaces && !withSpaces.endsWith(' ')) withSpaces += ' ';
      continue;
    }
    const normalized = normalizeChar(character);
    if (!normalized) continue;
    aggressive += normalized;
    withSpaces += normalized;
  }
  return { aggressive, withSpaces: withSpaces.trim() };
}

function findQuoteMatch(strings: string[], quote: string): QuoteMatch | undefined {
  let flat = '';
  const origin: MatchOrigin[] = [];

  strings.forEach((raw, itemIndex) => {
    let rawIndex = 0;
    while (rawIndex < raw.length) {
      const codePoint = raw.codePointAt(rawIndex);
      if (codePoint == null) break;
      const character = String.fromCodePoint(codePoint);
      const rawStart = rawIndex;
      rawIndex += character.length;
      if (/\s/.test(character)) continue;
      for (const part of character.normalize('NFKC')) {
        const normalized = normalizeChar(part);
        if (!normalized) continue;
        flat += normalized;
        origin.push({ itemIndex, rawStart, rawEnd: rawIndex });
      }
    }
  });

  const { aggressive, withSpaces } = normalizeQuote(quote);
  if (!aggressive) return undefined;
  const probes = [aggressive];
  const words = withSpaces.split(' ');
  while (words.length > 1) {
    words.pop();
    const probe = words.join('').trim();
    if (probe.length < 16) break;
    probes.push(probe);
  }

  for (const probe of probes) {
    const start = flat.indexOf(probe);
    if (start !== -1) return { origin, start, length: probe.length };
  }
  return undefined;
}

function highlightMatch(
  strings: string[],
  textDivs: HTMLElement[],
  quote: string,
): HTMLElement | undefined {
  const match = findQuoteMatch(strings, quote);
  if (!match) return undefined;
  const ranges = new Map<number, { rawStart: number; rawEnd: number }>();

  for (let index = match.start; index < match.start + match.length; index += 1) {
    const item = match.origin[index];
    if (!item) continue;
    const range = ranges.get(item.itemIndex);
    if (!range) {
      ranges.set(item.itemIndex, { rawStart: item.rawStart, rawEnd: item.rawEnd });
    } else {
      range.rawStart = Math.min(range.rawStart, item.rawStart);
      range.rawEnd = Math.max(range.rawEnd, item.rawEnd);
    }
  }

  let firstMark: HTMLElement | undefined;
  for (const [itemIndex, range] of [...ranges.entries()].sort((a, b) => a[0] - b[0])) {
    const textDiv = textDivs[itemIndex];
    const raw = strings[itemIndex] ?? '';
    if (!textDiv) continue;
    textDiv.replaceChildren();
    if (range.rawStart > 0) textDiv.append(document.createTextNode(raw.slice(0, range.rawStart)));
    const mark = document.createElement('mark');
    mark.className = 'inventory-paper-pdf__match';
    mark.textContent = raw.slice(range.rawStart, range.rawEnd);
    textDiv.append(mark);
    if (range.rawEnd < raw.length) textDiv.append(document.createTextNode(raw.slice(range.rawEnd)));
    firstMark ??= mark;
  }
  return firstMark;
}

function pageStrings(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  cache: Map<number, Promise<string[]>>,
): Promise<string[]> {
  const cached = cache.get(pageNumber);
  if (cached) return cached;
  const pending = pdf.getPage(pageNumber)
    .then((page) => page.getTextContent())
    .then((content) => content.items.map((item) => ('str' in item ? item.str : '')));
  cache.set(pageNumber, pending);
  void pending.catch(() => cache.delete(pageNumber));
  return pending;
}

async function pageStringsWithTimeout(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  cache: Map<number, Promise<string[]>>,
  timeoutMs = 10_000,
): Promise<string[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pageStrings(pdf, pageNumber, cache),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out extracting PDF page ${pageNumber}.`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    cache.delete(pageNumber);
    throw error;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function PaperPdfViewer({
  pdfUrl,
  title,
  focusRequest,
  pdfAssetBaseUrl,
}: PaperPdfViewerProps) {
  const assetBaseUrl = pdfAssetBaseUrl;
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [status, setStatus] = useState('Loading PDF…');
  const [hasRenderedTextLayer, setHasRenderedTextLayer] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<{
    requestKey: string;
    pageNumber: number;
    quote: string;
    fallback?: boolean | undefined;
  }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const textCacheRef = useRef(new Map<number, Promise<string[]>>());
  const quotePageCacheRef = useRef(new Map<string, number>());
  const searchTokenRef = useRef(0);
  const pageNumberRef = useRef(pageNumber);

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    let disposed = false;
    let loadedDocument: PDFDocumentProxy | undefined;
    let loadingTask: PdfLoadingTask | undefined;
    textCacheRef.current.clear();
    quotePageCacheRef.current.clear();
    setPdf(undefined);
    setPageNumber(1);
    setStatus('Loading PDF…');
    setHasRenderedTextLayer(false);

    if (typeof DOMMatrix === 'undefined') {
      setStatus('The embedded PDF viewer is unavailable in this browser. Use “Open PDF” instead.');
      return () => {
        disposed = true;
      };
    }

    void (async () => {
      try {
        const pdfjs = await loadPdfJs(assetBaseUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = pdfAssetUrl(assetBaseUrl, 'pdf.worker.min.mjs');
        loadingTask = pdfjs.getDocument({ url: withoutFragment(pdfUrl) });
        loadedDocument = await loadingTask.promise;
        if (disposed) return;
        setPdf(loadedDocument);
        setStatus(`Page 1 of ${loadedDocument.numPages}`);
      } catch {
        if (!disposed) setStatus('The PDF could not be loaded. Use “Open PDF” instead.');
      }
    })();

    return () => {
      disposed = true;
      searchTokenRef.current += 1;
      void loadingTask?.destroy();
      void loadedDocument?.destroy();
    };
  }, [assetBaseUrl, pdfUrl]);

  useEffect(() => {
    if (!pdf) return;
    let disposed = false;
    let renderTask: PdfRenderTask | undefined;
    let textLayer: PdfTextLayer | undefined;

    void (async () => {
      const canvas = canvasRef.current;
      const pageElement = pageRef.current;
      const scrollElement = scrollRef.current;
      const textLayerElement = textLayerRef.current;
      if (!canvas || !pageElement || !scrollElement || !textLayerElement) return;

      try {
        const pdfjs = await loadPdfJs(assetBaseUrl);
        const page = await pdf.getPage(pageNumber);
        if (disposed) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.25, (scrollElement.clientWidth - 32) / baseViewport.width);
        const viewport = page.getViewport({
          scale: fitScale * (ZOOM_LEVELS[zoomIndex] ?? 1),
        });
        const ratio = window.devicePixelRatio || 1;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        pageElement.style.width = `${viewport.width}px`;
        pageElement.style.height = `${viewport.height}px`;
        textLayerElement.replaceChildren();
        // PDF.js 5 reads --total-scale-factor; keep the older variable too so
        // this stays compatible if the package is rolled back.
        textLayerElement.style.setProperty('--total-scale-factor', String(viewport.scale));
        textLayerElement.style.setProperty('--scale-factor', String(viewport.scale));

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
        if (disposed) return;
        const textContent = await page.getTextContent();
        if (disposed) return;
        textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerElement,
          viewport,
        });
        await textLayer.render();
        if (disposed) return;
        setHasRenderedTextLayer(true);

        if (pendingHighlight?.pageNumber === pageNumber) {
          const match = highlightMatch(
            textLayer.textContentItemsStr,
            textLayer.textDivs,
            pendingHighlight.quote,
          );
          if (match) {
            match.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setStatus(`Quote highlighted on page ${pageNumber} of ${pdf.numPages}`);
          } else if (pendingHighlight.fallback) {
            scrollElement.scrollTo({ top: 0 });
            setStatus(`Exact quote not found; showing its cited page ${pageNumber} of ${pdf.numPages}`);
          } else {
            setStatus(`Page ${pageNumber} of ${pdf.numPages}`);
          }
        } else {
          setStatus(`Page ${pageNumber} of ${pdf.numPages}`);
          scrollElement.scrollTo({ top: 0 });
        }
      } catch (error) {
        if (!disposed && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setStatus('This PDF page could not be rendered.');
        }
      }
    })();

    return () => {
      disposed = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [assetBaseUrl, pageNumber, pdf, pendingHighlight, zoomIndex]);

  useEffect(() => {
    // Let the initial page finish rendering before asking PDF.js to extract
    // text from another page. Some worker/browser combinations otherwise
    // leave both operations waiting indefinitely.
    if (!pdf || !hasRenderedTextLayer || !focusRequest?.quote) return;
    const token = ++searchTokenRef.current;
    const cacheKey = `${focusRequest.insightId}\u0000${focusRequest.quote}`;
    const cachedPage = quotePageCacheRef.current.get(cacheKey);

    void (async () => {
      setStatus('Locating quote in the PDF…');
      let foundPage = cachedPage;
      if (!foundPage) {
        const order = [
          focusRequest.page,
          pageNumberRef.current,
          ...Array.from({ length: pdf.numPages }, (_, index) => index + 1),
        ]
          .filter((page): page is number => (
            page !== undefined && page >= 1 && page <= pdf.numPages
          ))
          .filter((page, index, pages) => pages.indexOf(page) === index);
        for (let index = 0; index < order.length; index += 1) {
          if (token !== searchTokenRef.current) return;
          const candidate = order[index];
          if (candidate === undefined) continue;
          let strings: string[];
          try {
            strings = await pageStringsWithTimeout(
              pdf,
              candidate,
              textCacheRef.current,
            );
          } catch {
            continue;
          }
          if (findQuoteMatch(strings, focusRequest.quote)) {
            foundPage = candidate;
            quotePageCacheRef.current.set(cacheKey, candidate);
            break;
          }
          if (index > 0 && index % 5 === 0) {
            setStatus(`Searching the PDF… ${Math.min(index + 1, order.length)}/${order.length}`);
          }
        }
      }
      if (token !== searchTokenRef.current) return;
      if (!foundPage) {
        if (
          focusRequest.page !== undefined
          && Number.isInteger(focusRequest.page)
          && focusRequest.page >= 1
          && focusRequest.page <= pdf.numPages
        ) {
          setPendingHighlight({
            requestKey: focusRequest.key,
            pageNumber: focusRequest.page,
            quote: focusRequest.quote,
            fallback: true,
          });
          setPageNumber(focusRequest.page);
          return;
        }
        setStatus('The exact quote was not found in the PDF text layer.');
        return;
      }
      setPendingHighlight({
        requestKey: focusRequest.key,
        pageNumber: foundPage,
        quote: focusRequest.quote,
      });
      setPageNumber(foundPage);
    })();
  }, [focusRequest, hasRenderedTextLayer, pdf]);

  const changePage = (nextPage: number) => {
    if (!pdf) return;
    searchTokenRef.current += 1;
    setPendingHighlight(undefined);
    setPageNumber(Math.min(pdf.numPages, Math.max(1, nextPage)));
  };

  return (
    <div className="inventory-paper-pdf" aria-label={`PDF viewer for ${title}`}>
      <div className="inventory-paper-pdf__toolbar">
        <div className="inventory-paper-pdf__page-controls">
          <button type="button" disabled={!pdf || pageNumber <= 1} onClick={() => changePage(pageNumber - 1)} aria-label="Previous PDF page">←</button>
          <span aria-live="polite" title={status}>{status}</span>
          <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => changePage(pageNumber + 1)} aria-label="Next PDF page">→</button>
        </div>
        <div className="inventory-paper-pdf__zoom-controls">
          <button type="button" disabled={!pdf || zoomIndex === 0} onClick={() => setZoomIndex((index) => Math.max(0, index - 1))} aria-label="Zoom PDF out">−</button>
          <span>{Math.round((ZOOM_LEVELS[zoomIndex] ?? 1) * 100)}%</span>
          <button type="button" disabled={!pdf || zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))} aria-label="Zoom PDF in">+</button>
        </div>
        <a href={withoutFragment(pdfUrl)} target="_blank" rel="noreferrer" aria-label="Open PDF in a new tab">Open ↗</a>
      </div>
      <div ref={scrollRef} className="inventory-paper-pdf__scroll">
        <div ref={pageRef} className="inventory-paper-pdf__page">
          <canvas ref={canvasRef} />
          <div ref={textLayerRef} className="textLayer inventory-paper-pdf__text-layer" />
        </div>
      </div>
    </div>
  );
}
