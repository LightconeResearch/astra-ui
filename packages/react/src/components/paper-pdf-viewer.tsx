import { forwardRef, useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { useLabels } from '../lib/labels.js';
import { useIsomorphicLayoutEffect } from '../lib/use-isomorphic-layout-effect.js';
import {
  highlightMatch,
  locateQuote,
  pageText,
  type PdfPassage,
  type PdfPassageLocation,
  type PdfTextCache,
} from '../lib/pdf-quote.js';
import type { PdfDocument, PdfJs, PdfJsLoader, PdfLoadingTask, PdfRenderTask, PdfTextLayer } from '../lib/pdf-runtime.js';

export type { PdfPassage } from '../lib/pdf-quote.js';

export type PdfLoadState = 'loading' | 'ready' | 'error';

export interface PaperPdfViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  pdfUrl: string;
  /** Names the viewer for assistive technology. */
  title: string;
  /** Called once per document; a later identity is ignored, so an inline function is fine. */
  loadPdfJs: PdfJsLoader;
  /** Scrolls to and highlights a passage once the document is readable; a new `key` repeats the request. */
  passage?: PdfPassage | undefined;
  /** Reports loading, readiness, or failure with its reason. The latest callback is used; identity is not tracked. */
  onLoadStateChange?: ((state: PdfLoadState, error?: unknown) => void) | undefined;
}

interface Loaded {
  pdf: PdfDocument;
  runtime: PdfJs;
  text: PdfTextCache;
}

interface Focus extends PdfPassageLocation {
  key: string;
}

/** iOS Safari's canvas area limit (4096 x 4096); CSS scales a smaller backing store up to the page shell. */
const MAX_CANVAS_PIXELS = 16_777_216;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

function Page({ loaded, number, width, zoom, focus }: {
  loaded: Loaded;
  number: number;
  width: number;
  zoom: number;
  focus: Focus | undefined;
}) {
  const { pdf: labels } = useLabels();
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(number === 1);
  const [aspectRatio, setAspectRatio] = useState(612 / 792);
  const [failed, setFailed] = useState(false);
  // The rendered text layer lives in a ref so the render effect's cleanup can
  // drop it synchronously; the version re-runs the highlight effect once a
  // render attempt has settled, so a locate request never lands on detached
  // spans and still brings a page without a text layer into view.
  const layerRef = useRef<PdfTextLayer | undefined>(undefined);
  const settledRef = useRef(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const scrolledRequest = useRef<string | undefined>(undefined);
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

  // Shells keep their geometry whether or not they are rasterized, so mixed page sizes scroll correctly.
  useEffect(() => {
    let disposed = false;
    void loaded.pdf.getPage(number).then((page) => {
      if (disposed) return;
      const viewport = page.getViewport({ scale: 1 });
      setAspectRatio(viewport.width / viewport.height);
    }).catch(() => { /* Rendering reports errors for pages the reader visits. */ });
    return () => { disposed = true; };
  }, [loaded, number]);

  useEffect(() => {
    if (!active || width === 0) return;
    const canvas = canvasRef.current;
    const text = textRef.current;
    if (!canvas || !text) return;
    let disposed = false;
    let task: PdfRenderTask | undefined;
    let layer: PdfTextLayer | undefined;
    setFailed(false);
    void (async () => {
      let rasterized = false;
      try {
        const page = await loaded.pdf.getPage(number);
        if (disposed) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width * zoom / base.width });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)),
        );
        // Rounded down, so the backing store never exceeds the cap the ratio was derived from.
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        text.replaceChildren();
        // pdf.js 4.8 sizes the text layer from --scale-factor; later text layers read --total-scale-factor.
        text.style.setProperty('--scale-factor', String(viewport.scale));
        text.style.setProperty('--total-scale-factor', String(viewport.scale));
        task = page.render({ canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        task = undefined;
        rasterized = true;
        if (disposed) return;
        const content = await pageText(loaded.pdf, number, loaded.text);
        if (disposed) return;
        layer = new loaded.runtime.TextLayer({ textContentSource: content, container: text, viewport });
        await layer.render();
        const rendered = layer;
        layer = undefined;
        if (disposed) return;
        layerRef.current = rendered;
      } catch {
        // A page without extractable text still shows its canvas.
        if (!disposed && !rasterized) setFailed(true);
      }
      if (disposed) return;
      settledRef.current = true;
      setRenderVersion((version) => version + 1);
    })();
    return () => {
      disposed = true;
      layerRef.current = undefined;
      settledRef.current = false;
      // Only work still in flight is cancelled; settled tasks were released above.
      task?.cancel();
      layer?.cancel();
      canvas.width = 0;
      canvas.height = 0;
      text.replaceChildren();
    };
  }, [active, loaded, number, width, zoom]);

  useEffect(() => {
    // Clear the previous request even when the next one lands on the same page.
    if (!focus) scrolledRequest.current = undefined;
    if (!active || !settledRef.current) return;
    const layer = layerRef.current;
    // pdf.js keeps a span for every item, attached only when the item has text.
    layer?.textDivs.forEach((div, index) => { div.textContent = layer.textContentItemsStr[index] ?? ''; });
    if (!focus) return;
    const mark = layer && focus.match ? highlightMatch(layer.textContentItemsStr, layer.textDivs, focus.match) : undefined;
    // Zoom and resize rebuild the marks without taking the reader back to a
    // passage they have already located and scrolled away from.
    if (scrolledRequest.current !== focus.key) {
      (mark ?? shellRef.current)?.scrollIntoView({ block: 'center' });
      scrolledRequest.current = focus.key;
    }
  }, [active, renderVersion, focus]);

  return (
    <div ref={shellRef} className="astra-paper-pdf__page" data-page={number} role="group"
      aria-label={labels.page(number)} style={{ width: width * zoom, aspectRatio }}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div ref={textRef} className="astra-paper-pdf__text" />
      {failed ? <p role="alert">{labels.pageError(number)}</p> : null}
    </div>
  );
}

/** Continuous PDF reading and passage navigation; the host supplies pdf.js through `loadPdfJs`. */
export const PaperPdfViewer = forwardRef<HTMLDivElement, PaperPdfViewerProps>(function PaperPdfViewer(props, ref) {
  // A new URL is a new document: geometry, text cache and requests start over.
  return <DocumentViewer key={props.pdfUrl} {...props} ref={ref} />;
});

const DocumentViewer = forwardRef<HTMLDivElement, PaperPdfViewerProps>(function DocumentViewer({
  pdfUrl, title, loadPdfJs, passage, onLoadStateChange, className, ...props
}, ref) {
  const { pdf: labels } = useLabels();
  // One load per mounted document, with the loader present at mount.
  const [loader] = useState(() => loadPdfJs);
  const [result, setResult] = useState<{ status: 'ready'; loaded: Loaded } | { status: 'error'; error: unknown }>();
  const loaded = result?.status === 'ready' ? result.loaded : undefined;
  const [located, setLocated] = useState<{ request: PdfPassage; focus: Focus | undefined }>();
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ shell: HTMLElement; fraction: number } | undefined>(undefined);
  const report = useRef(onLoadStateChange);
  useEffect(() => { report.current = onLoadStateChange; });

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

  // Before paint, so a zoom step never flashes the page at the wrong offset.
  useIsomorphicLayoutEffect(() => {
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
        const runtime = await loader();
        if (disposed) return;
        task = runtime.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        if (!disposed) setResult({ status: 'ready', loaded: { pdf, runtime, text: new Map() } });
      } catch (error) {
        release();
        if (!disposed) setResult({ status: 'error', error });
      }
    })();
    return () => {
      disposed = true;
      release();
    };
  }, [loader, pdfUrl]);

  useEffect(() => {
    report.current?.(result?.status ?? 'loading', result?.status === 'error' ? result.error : undefined);
  }, [result]);

  const key = passage?.key;
  const quote = passage?.quote;
  const page = passage?.page;
  useEffect(() => {
    if (!loaded || key === undefined) return;
    const abort = new AbortController();
    void locateQuote(loaded.pdf, { quote, page }, loaded.text, abort.signal).then((location) => {
      if (!abort.signal.aborted) setLocated({ request: { key, quote, page }, focus: location && { ...location, key } });
    });
    return () => { abort.abort(); };
  }, [loaded, key, quote, page]);
  // A result answers one request; an edited quote or page under the same key is a new search.
  const current = located && located.request.key === key && located.request.quote === quote && located.request.page === page
    ? located
    : undefined;
  const focus = current?.focus;

  const status = result?.status === 'error' ? labels.loadError
    : !loaded ? labels.loading
      : key === undefined ? labels.pageCount(loaded.pdf.numPages)
        : !current ? labels.searching
          : !focus ? labels.quoteNotFound
            : focus.match
              ? (focus.match.complete ? labels.quoteHighlighted : labels.partialQuoteHighlighted)(focus.page, loaded.pdf.numPages)
              : labels.citedPageFallback(focus.page, loaded.pdf.numPages);

  const zoomBy = (step: number) => { rememberPosition(); setZoom((value) => value + step); };

  return (
    <div data-slot="paper-pdf-viewer" role="group" aria-label={labels.viewer(title)} {...props} ref={ref}
      className={cn('astra-paper-pdf', className)}>
      <div className="astra-paper-pdf__toolbar">
        <span role="status">{status}</span>
        <button type="button" disabled={!loaded || zoom <= ZOOM_MIN} aria-label={labels.zoomOut}
          onClick={() => { zoomBy(-ZOOM_STEP); }}>−</button>
        <span>{labels.zoomLevel(Math.round(zoom * 100))}</span>
        <button type="button" disabled={!loaded || zoom >= ZOOM_MAX} aria-label={labels.zoomIn}
          onClick={() => { zoomBy(ZOOM_STEP); }}>+</button>
      </div>
      {/* Keyboard focus lets readers scroll the PDF with arrows and Page Up/Down. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={scrollRef} className="astra-paper-pdf__scroll" role="region" tabIndex={0} aria-label={labels.pages}>
        {loaded ? Array.from({ length: loaded.pdf.numPages }, (_, index) => (
          <Page key={index} loaded={loaded} number={index + 1} width={width} zoom={zoom}
            focus={focus?.page === index + 1 ? focus : undefined} />
        )) : null}
      </div>
    </div>
  );
});
