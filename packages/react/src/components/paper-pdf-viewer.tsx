import type { PaperRenderOptions } from './paper-detail.js';
import type { InventoryPaper } from '../model/papers.js';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  findQuoteMatch, highlightMatch, pageStringsWithTimeout,
  type PDFDocumentProxy, type PdfJs, type PdfLoadingTask, type PdfRenderTask, type PdfTextLayer,
} from './pdf-quote.js';

function withoutFragment(url: string): string { return url.split('#')[0] ?? url; }

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
  /** Host-owned runtime and worker initialization. Keep this callback stable. */
  loadPdfJs: () => Promise<PdfJs>;
}

export function PaperViewer({
  options,
  paper,
  loadPdfJs,
}: {
  options: PaperRenderOptions;
  paper: InventoryPaper;
  loadPdfJs: () => Promise<PdfJs>;
}): ReactElement | null {
  if (!paper.pdfUrl) return null;
  const focus = options.focusEvidence;
  const exactQuote = focus?.evidence.quote?.exact;
  const focusRequest = focus && exactQuote
    ? {
        key: focus.key,
        insightId: focus.insight.canonicalPath,
        quote: exactQuote,
        ...(focus.evidence.location?.page === undefined
          ? {}
          : { page: focus.evidence.location.page }),
      }
    : undefined;
  return (
    <PaperPdfViewer
      pdfUrl={paper.pdfUrl}
      title={paper.title}
      focusRequest={focusRequest}
      loadPdfJs={loadPdfJs}
    />
  );
}

const ZOOM_LEVELS = [0.8, 1, 1.25, 1.5, 2];

interface PendingHighlight {
  pageNumber: number;
  quote: string;
  fallback?: boolean | undefined;
  /** Set once the highlight (or its fallback scroll) has run, so zoom
      re-renders re-mark the text without scrolling again. */
  applied?: boolean;
}

interface PageRenderer {
  refreshHighlight: () => void;
  clearHighlight: () => void;
}

export function PaperPdfViewer(props: PaperPdfViewerProps): ReactElement {
  return <PdfDocumentViewer key={props.pdfUrl} {...props} />;
}

function PdfDocumentViewer({
  pdfUrl,
  title,
  focusRequest,
  loadPdfJs,
}: PaperPdfViewerProps) {
  const [loaded, setLoaded] = useState<{ pdf: PDFDocumentProxy; runtime: PdfJs }>();
  const pdf = loaded?.pdf;
  const numPages = pdf?.numPages ?? 0;
  const [zoomIndex, setZoomIndex] = useState(1);
  const [status, setStatus] = useState<string | undefined>('Loading PDF…');
  const [hasRenderedTextLayer, setHasRenderedTextLayer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const shellsRef = useRef(new Map<number, HTMLDivElement>());
  const textCacheRef = useRef(new Map<number, Promise<string[]>>());
  const quotePageCacheRef = useRef(new Map<string, number>());
  const searchTokenRef = useRef(0);
  const pendingHighlightRef = useRef<PendingHighlight | undefined>(undefined);
  const rendererRef = useRef<PageRenderer | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let loadingTask: PdfLoadingTask | undefined;
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (disposed) return;
        loadingTask = pdfjs.getDocument({ url: withoutFragment(pdfUrl) });
        const loadedDocument = await loadingTask.promise;
        if (disposed) return;
        setLoaded({ pdf: loadedDocument, runtime: pdfjs });
        setStatus(undefined);
      } catch {
        if (!disposed) setStatus('The PDF could not be loaded. Use “Open PDF” instead.');
      }
    })();

    return () => {
      disposed = true;
      searchTokenRef.current += 1;
      void loadingTask?.destroy();
    };
  }, [loadPdfJs, pdfUrl]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const observer = new ResizeObserver(() => { setViewportWidth(scroll.clientWidth); });
    observer.observe(scroll);
    return () => { observer.disconnect(); };
  }, []);

  // Continuous layout: every page gets a correctly-sized shell up front, and
  // an IntersectionObserver renders shells as they scroll near the viewport.
  // A zoom change re-runs the effect, which re-sizes and re-renders.
  useEffect(() => {
    if (!loaded) return;
    const { pdf, runtime: pdfjs } = loaded;
    const numPages = pdf.numPages;
    let disposed = false;
    let observer: IntersectionObserver | undefined;
    const active = new Map<number, { task?: PdfRenderTask; layer?: PdfTextLayer }>();
    const textLayers = new Map<number, PdfTextLayer>();
    const rendered = new Set<number>();
    const inFlight = new Set<number>();

    void (async () => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;
      try {
        const firstPage = await pdf.getPage(1);
        if (disposed) return;
        const baseViewport = firstPage.getViewport({ scale: 1 });
        const fitScale = Math.max(0.25, (scrollElement.clientWidth - 32) / baseViewport.width);
        const scale = fitScale * (ZOOM_LEVELS[zoomIndex] ?? 1);

        // Stop any in-flight locate animation before resizing. Preserve a
        // visible highlighted passage at its current viewport offset; otherwise
        // preserve the reader's position in the document.
        scrollElement.scrollTo({ top: scrollElement.scrollTop, behavior: 'instant' });
        const previousHighlight = pendingHighlightRef.current;
        const markBounds = scrollElement.querySelector('.astra-paper-pdf__match')?.getBoundingClientRect();
        const scrollBounds = scrollElement.getBoundingClientRect();
        let highlightOffset = markBounds && markBounds.height > 0 &&
          markBounds.top >= scrollBounds.top && markBounds.bottom <= scrollBounds.bottom
          ? markBounds.top - scrollBounds.top
          : undefined;
        const scrollRatio = scrollElement.scrollHeight > 0
          ? scrollElement.scrollTop / scrollElement.scrollHeight
          : 0;
        for (let n = 1; n <= numPages; n += 1) {
          if (disposed) return;
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale });
          const shell = shellsRef.current.get(n);
          if (!shell) continue;
          shell.style.width = `${viewport.width}px`;
          shell.style.height = `${viewport.height}px`;
        }
        if (disposed) return;
        scrollElement.scrollTop = scrollRatio * scrollElement.scrollHeight;

        const applyHighlight = (n: number) => {
          const pending = pendingHighlightRef.current;
          if (pending?.pageNumber !== n) return;
          const layer = textLayers.get(n);
          if (!layer) return;
          const mark = highlightMatch(layer.textContentItemsStr, layer.textDivs, pending.quote);
          if (mark) {
            if (pending === previousHighlight && highlightOffset !== undefined) {
              scrollElement.scrollTop += mark.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top - highlightOffset;
              highlightOffset = undefined;
            } else if (!pending.applied) {
              mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setStatus(undefined);
            }
            pending.applied = true;
          } else if (pending.fallback) {
            if (!pending.applied) {
              shellsRef.current.get(n)?.scrollIntoView({ block: 'start' });
              setStatus('Exact quote not found; showing its cited page.');
            }
            pending.applied = true;
          }
        };

        const renderPage = async (n: number) => {
          if (disposed || rendered.has(n) || inFlight.has(n)) return;
          inFlight.add(n);
          try {
            const shell = shellsRef.current.get(n);
            const canvas = shell?.querySelector('canvas');
            const textLayerElement = shell?.querySelector<HTMLElement>('.astra-paper-pdf__text-layer');
            if (!shell || !canvas || !textLayerElement) return;
            const page = await pdf.getPage(n);
            if (disposed) return;
            const viewport = page.getViewport({ scale });
            const ratio = window.devicePixelRatio || 1;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = Math.floor(viewport.width * ratio);
            canvas.height = Math.floor(viewport.height * ratio);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            textLayerElement.replaceChildren();
            // PDF.js 5 reads --total-scale-factor; keep the older variable too
            // so this remains stable if the package version changes.
            textLayerElement.style.setProperty('--total-scale-factor', String(viewport.scale));
            textLayerElement.style.setProperty('--scale-factor', String(viewport.scale));

            const task = page.render({
              canvasContext: context,
              viewport,
              transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
            });
            active.set(n, { task });
            await task.promise;
            if (disposed) return;
            const textContent = await page.getTextContent();
            if (disposed) return;
            const layer = new pdfjs.TextLayer({
              textContentSource: textContent,
              container: textLayerElement,
              viewport,
            });
            active.set(n, { task, layer });
            await layer.render();
            if (disposed) return;
            rendered.add(n);
            textLayers.set(n, layer);
            setHasRenderedTextLayer(true);
            applyHighlight(n);
          } catch (error) {
            if (!disposed && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
              setStatus('A PDF page could not be rendered.');
            }
          } finally {
            active.delete(n);
            inFlight.delete(n);
          }
        };

        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const n = Number((entry.target as HTMLElement).dataset.page);
            if (n) void renderPage(n);
          }
        }, { root: scrollElement, rootMargin: '150% 0px' });
        for (const shell of shellsRef.current.values()) observer.observe(shell);

        rendererRef.current = {
          clearHighlight: () => {
            for (const layer of textLayers.values()) {
              layer.textDivs.forEach((div, index) => { div.textContent = layer.textContentItemsStr[index] ?? ''; });
            }
          },
          refreshHighlight: () => {
            const pending = pendingHighlightRef.current;
            if (!pending) return;
            void renderPage(pending.pageNumber);
            applyHighlight(pending.pageNumber);
          },
        };
        // A highlight may already be waiting (zoom change re-runs the effect).
        rendererRef.current.refreshHighlight();
      } catch {
        if (!disposed) setStatus('The PDF could not be rendered.');
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      rendererRef.current = undefined;
      for (const { task, layer } of active.values()) {
        task?.cancel();
        layer?.cancel();
      }
    };
  }, [loaded, viewportWidth, zoomIndex]);

  const focusKey = focusRequest?.key;
  const insightId = focusRequest?.insightId;
  const quote = focusRequest?.quote;
  const citedPage = focusRequest?.page;
  useEffect(() => {
    const token = ++searchTokenRef.current;
    pendingHighlightRef.current = undefined;
    rendererRef.current?.clearHighlight();
    // Let the initial page finish rendering before asking PDF.js to extract
    // text from another page. Some worker/browser combinations otherwise
    // leave both operations waiting indefinitely.
    if (!pdf || !hasRenderedTextLayer) return;

    void (async () => {
      if (!quote) { setStatus(undefined); return; }
      setStatus('Locating quote in the PDF…');
      const cacheKey = `${insightId ?? ''}\u0000${quote}`;
      const cachedPage = quotePageCacheRef.current.get(cacheKey);
      let foundPage = cachedPage;
      if (!foundPage) {
        const order = [
          citedPage,
          ...Array.from({ length: pdf.numPages }, (_, index) => index + 1),
        ]
          .filter((page): page is number => (
            page !== undefined && Number.isInteger(page) && page >= 1 && page <= pdf.numPages
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
          if (token !== searchTokenRef.current) return;
          if (findQuoteMatch(strings, quote)) {
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
          citedPage !== undefined
          && Number.isInteger(citedPage)
          && citedPage >= 1
          && citedPage <= pdf.numPages
        ) {
          pendingHighlightRef.current = {
            pageNumber: citedPage,
            quote,
            fallback: true,
          };
          rendererRef.current?.refreshHighlight();
          return;
        }
        setStatus('The exact quote was not found in the PDF text layer.');
        return;
      }
      pendingHighlightRef.current = {
        pageNumber: foundPage,
        quote,
      };
      rendererRef.current?.refreshHighlight();
    })();
    return () => { searchTokenRef.current += 1; };
  }, [focusKey, insightId, quote, citedPage, hasRenderedTextLayer, pdf]);

  return (
    <div className="astra-paper-pdf" aria-label={`PDF viewer for ${title}`}>
      <div className="astra-paper-pdf__zoom-controls">
        <button type="button" disabled={!pdf || zoomIndex === 0} onClick={() => { setZoomIndex((index) => Math.max(0, index - 1)); }} aria-label="Zoom PDF out">−</button>
        <span>{Math.round((ZOOM_LEVELS[zoomIndex] ?? 1) * 100)}%</span>
        <button type="button" disabled={!pdf || zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => { setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1)); }} aria-label="Zoom PDF in">+</button>
      </div>
      {status ? (
        <div className="astra-paper-pdf__status" role="status" aria-live="polite">{status}</div>
      ) : null}
      <div ref={scrollRef} className="astra-paper-pdf__scroll">
        {Array.from({ length: numPages }, (_, index) => {
          const n = index + 1;
          return (
            <div
              key={n}
              data-page={n}
              className="astra-paper-pdf__page"
              ref={(element) => {
                if (element) {
                  shellsRef.current.set(n, element);
                } else {
                  shellsRef.current.delete(n);
                }
              }}
            >
              <canvas />
              <div className="textLayer astra-paper-pdf__text-layer" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
