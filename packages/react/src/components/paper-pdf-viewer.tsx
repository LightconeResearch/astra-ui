import { forwardRef, useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import type { PaperFocusEvidence } from '../model/papers.js';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { highlightMatch } from './pdf-quote.js';
import { locateQuote, type PdfQuoteLocation, type PdfTextCache } from './pdf-search.js';
import type { PdfDocument, PdfJs, PdfJsLoader, PdfLoadingTask, PdfRenderTask, PdfTextLayer } from './pdf-runtime.js';

export interface PaperPdfViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  pdfUrl: string;
  title: string;
  focusEvidence?: PaperFocusEvidence | undefined;
  loadPdfJs: PdfJsLoader;
}

interface FocusLocation extends PdfQuoteLocation {
  key: string;
}

function Page({ pdf, runtime, number, width, zoom, focus }: {
  pdf: PdfDocument;
  runtime: PdfJs;
  number: number;
  width: number;
  zoom: number;
  focus: FocusLocation | undefined;
}) {
  const { pdf: labels } = useLabels();
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(number === 1);
  const [aspectRatio, setAspectRatio] = useState(612 / 792);
  const [layer, setLayer] = useState<PdfTextLayer>();
  const renderedLayer = useRef<PdfTextLayer>();
  const [failed, setFailed] = useState(false);
  const scrolledRequest = useRef<string>();
  const active = nearby || focus !== undefined;

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new IntersectionObserver(
      (entries) => { setNearby(entries.some((entry) => entry.isIntersecting)); },
      { root: shell.parentElement, rootMargin: '600px' },
    );
    observer.observe(shell);
    return () => { observer.disconnect(); };
  }, []);

  // Measure shells independently of rasterization, including mixed page sizes.
  useEffect(() => {
    let disposed = false;
    void pdf.getPage(number).then((page) => {
      if (disposed) return;
      const viewport = page.getViewport({ scale: 1 });
      setAspectRatio(viewport.width / viewport.height);
    }).catch(() => { /* Rendering reports errors for pages the reader visits. */ });
    return () => { disposed = true; };
  }, [pdf, number]);

  useEffect(() => {
    if (!active || width === 0) return;
    const canvas = canvasRef.current;
    const text = textRef.current;
    if (!canvas || !text) return;
    let disposed = false;
    let task: PdfRenderTask | undefined;
    let textLayer: PdfTextLayer | undefined;
    setLayer(undefined);
    setFailed(false);
    void (async () => {
      try {
        const page = await pdf.getPage(number);
        if (disposed) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width * zoom / base.width });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        text.replaceChildren();
        text.style.setProperty('--scale-factor', String(viewport.scale));
        text.style.setProperty('--total-scale-factor', String(viewport.scale));
        task = page.render({ canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (disposed) return;
        const content = await page.getTextContent();
        if (disposed) return;
        textLayer = runtime.createTextLayer({ textContentSource: content, container: text, viewport });
        await textLayer.render();
        if (!disposed) {
          renderedLayer.current = textLayer;
          setLayer(textLayer);
        }
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      renderedLayer.current = undefined;
      task?.cancel();
      textLayer?.cancel();
      canvas.width = 0;
      canvas.height = 0;
      text.replaceChildren();
    };
  }, [active, pdf, runtime, number, width, zoom]);

  useEffect(() => {
    // Clear the previous request even when returning to the same page.
    if (!focus) scrolledRequest.current = undefined;
    // State can still contain the old layer in the commit that releases or
    // rebuilds a page. Never consume a locate request on its detached spans.
    if (!layer || !active || layer !== renderedLayer.current) return;
    layer.textDivs.forEach((div, index) => { div.textContent = layer.textContentItemsStr[index] ?? ''; });
    if (!focus) return;
    const mark = focus.match ? highlightMatch(layer.textContentItemsStr, layer.textDivs, focus.match) : undefined;
    // Zoom and resize rebuild the marks without repeatedly taking the reader
    // back to a passage they have already located and scrolled away from.
    if (scrolledRequest.current !== focus.key) {
      (mark ?? shellRef.current)?.scrollIntoView({ block: 'center' });
      scrolledRequest.current = focus.key;
    }
  }, [active, layer, focus]);

  return (
    <div ref={shellRef} className="astra-paper-pdf__page" data-page={number}
      aria-label={labels.page(number)} style={{ width: width * zoom, aspectRatio }}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div ref={textRef} className="astra-paper-pdf__text" />
      {failed ? <p role="status">{labels.pageError(number)}</p> : null}
    </div>
  );
}

/** Continuous PDF reading and evidence navigation; the host supplies PDF.js. */
export const PaperPdfViewer = forwardRef<HTMLDivElement, PaperPdfViewerProps>(function PaperPdfViewer(props, ref) {
  // Reset document-local geometry, text caches and requests when the URL changes.
  return <DocumentViewer key={props.pdfUrl} {...props} ref={ref} />;
});

const DocumentViewer = forwardRef<HTMLDivElement, PaperPdfViewerProps>(function DocumentViewer({
  pdfUrl, title, focusEvidence, loadPdfJs, className, ...props
}, ref) {
  const { pdf: labels } = useLabels();
  interface Loaded { pdf: PdfDocument; runtime: PdfJs; cache: PdfTextCache }
  const [loadResult, setLoadResult] = useState<{ loader: PdfJsLoader; loaded?: Loaded; failed?: boolean }>();
  const loaded = loadResult?.loader === loadPdfJs ? loadResult.loaded : undefined;
  const [searchResult, setSearchResult] = useState<{
    loaded: Loaded;
    requestKey: string;
    quote: string | undefined;
    page: number | undefined;
    focus: FocusLocation | undefined;
  }>();
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ shell: HTMLElement; fraction: number }>();

  const rememberPosition = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const top = scroll.getBoundingClientRect().top;
    for (const shell of scroll.querySelectorAll<HTMLElement>('[data-page]')) {
      const bounds = shell.getBoundingClientRect();
      if (bounds.bottom > top && bounds.height > 0) {
        anchorRef.current = { shell, fraction: (top - bounds.top) / bounds.height };
        break;
      }
    }
  }, []);

  useEffect(() => {
    const scroll = scrollRef.current;
    const anchor = anchorRef.current;
    if (scroll && anchor) {
      const bounds = anchor.shell.getBoundingClientRect();
      scroll.scrollTop += bounds.top - scroll.getBoundingClientRect().top + bounds.height * anchor.fraction;
      anchorRef.current = undefined;
    }
  }, [zoom, width]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const resize = () => { rememberPosition(); setWidth(Math.max(100, node.clientWidth - 32)); };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, [rememberPosition]);

  useEffect(() => {
    let disposed = false;
    let task: PdfLoadingTask | undefined;
    const release = () => {
      const current = task;
      task = undefined;
      void current?.destroy().catch(() => { /* The document is already unavailable. */ });
    };
    void (async () => {
      try {
        const runtime = await loadPdfJs();
        if (disposed) return;
        task = runtime.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        if (!disposed) {
          setLoadResult({ loader: loadPdfJs, loaded: { pdf, runtime, cache: new Map() } });
        }
      } catch {
        release();
        if (!disposed) setLoadResult({ loader: loadPdfJs, failed: true });
      }
    })();
    return () => {
      disposed = true;
      release();
    };
  }, [loadPdfJs, pdfUrl]);

  const requestKey = focusEvidence?.key;
  const quote = focusEvidence?.evidence.quote?.exact;
  const page = focusEvidence?.evidence.location?.page;
  const currentSearch = searchResult?.loaded === loaded && searchResult?.requestKey === requestKey
    && searchResult?.quote === quote && searchResult?.page === page ? searchResult : undefined;
  const focus = currentSearch?.focus;
  const status = !loaded
    ? (loadResult?.loader === loadPdfJs && loadResult.failed ? labels.loadError : labels.loading)
    : requestKey === undefined ? labels.pageCount(loaded.pdf.numPages)
      : !currentSearch ? labels.searching
        : !focus ? labels.quoteNotFound
          : focus.match
            ? (focus.match.complete ? labels.quoteHighlighted : labels.partialQuoteHighlighted)(focus.page, loaded.pdf.numPages)
            : labels.citedPageFallback(focus.page, loaded.pdf.numPages);
  useEffect(() => {
    if (!loaded || requestKey === undefined) return;
    const abort = new AbortController();
    void locateQuote(loaded.pdf, quote, page, loaded.cache, abort.signal).then((result) => {
      if (abort.signal.aborted) return;
      setSearchResult({ loaded, requestKey, quote, page, focus: result ? { ...result, key: requestKey } : undefined });
    });
    return () => { abort.abort(); };
  }, [loaded, requestKey, quote, page]);

  return (
    <div data-slot="paper-pdf-viewer" aria-label={labels.viewer(title)} {...props} ref={ref}
      className={cn('astra-paper-pdf', className)}>
      <div className="astra-paper-pdf__toolbar">
        <span role="status" aria-live="polite">{status}</span>
        <button type="button" disabled={!loaded || zoom <= 0.5} aria-label={labels.zoomOut}
          onClick={() => { rememberPosition(); setZoom((value) => value - 0.25); }}>−</button>
        <span>{labels.zoomLevel(Math.round(zoom * 100))}</span>
        <button type="button" disabled={!loaded || zoom >= 2} aria-label={labels.zoomIn}
          onClick={() => { rememberPosition(); setZoom((value) => value + 0.25); }}>+</button>
      </div>
      {/* Keyboard focus lets readers scroll the PDF with arrows and Page Up/Down. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={scrollRef} className="astra-paper-pdf__scroll" role="region" tabIndex={0} aria-label={labels.pages}>
        {loaded ? Array.from({ length: loaded.pdf.numPages }, (_, index) => (
          <Page key={index} pdf={loaded.pdf} runtime={loaded.runtime} number={index + 1} width={width} zoom={zoom}
            focus={focus?.page === index + 1 ? focus : undefined} />
        )) : null}
      </div>
    </div>
  );
});
