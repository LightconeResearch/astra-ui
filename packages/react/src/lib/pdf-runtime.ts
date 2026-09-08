/**
 * The pdf.js surface the viewer uses, as structural types. The `pdfjs-dist`
 * module satisfies `PdfJs`: a host's `loadPdfJs` imports the module, points
 * `GlobalWorkerOptions.workerSrc` at the matching worker script and returns
 * the module. Nothing here imports pdf.js or React; the components layer
 * re-exports what hosts need.
 */

/** Always the object `getViewport()` returned; pdf.js reads more of it than these fields. Never construct one. */
export interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

/** A `getTextContent()` result. Only `str` items are read; the object goes back to pdf.js unchanged. */
export interface PdfTextContent {
  items: unknown[];
}

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PdfPage {
  getViewport(options: { scale: number }): PdfViewport;
  getTextContent(): Promise<PdfTextContent>;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    transform?: number[] | undefined;
  }): PdfRenderTask;
}

export interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<PdfPage>;
}

export interface PdfLoadingTask {
  /** May stay pending forever once `destroy()` has been called; never await it after that. */
  promise: Promise<PdfDocument>;
  /** Aborts loading and releases the document together with the worker pdf.js started for it. */
  destroy(): Promise<void>;
}

export interface PdfTextLayerOptions {
  /** The `getTextContent()` result, passed back as pdf.js produced it. */
  textContentSource: object;
  container: HTMLElement;
  viewport: PdfViewport;
}

/**
 * pdf.js's `TextLayer`. An ambient class rather than a construct signature
 * because TypeScript relates class constructor parameters bivariantly, which
 * lets the real class (whose constructor takes pdf.js's own wider types)
 * satisfy `PdfJs`. Only its types are exported: the class has no runtime
 * binding.
 */
declare class PdfTextLayerClass {
  constructor(options: PdfTextLayerOptions);
  readonly textDivs: HTMLElement[];
  readonly textContentItemsStr: string[];
  render(): Promise<void>;
  cancel(): void;
}

export type PdfTextLayer = PdfTextLayerClass;
export type PdfTextLayerConstructor = typeof PdfTextLayerClass;

/** What `loadPdfJs` resolves to: the `pdfjs-dist` module, or anything shaped like it. */
export interface PdfJs {
  getDocument(options: { url: string }): PdfLoadingTask;
  TextLayer: PdfTextLayerConstructor;
}

/**
 * Imports pdf.js in the browser and returns it with `GlobalWorkerOptions.workerSrc`
 * set to the matching worker script; pdf.js then starts one worker per document
 * and terminates it with the document. Import inside the callback so server
 * rendering never touches browser APIs.
 */
export type PdfJsLoader = () => Promise<PdfJs>;

/** The extra pdf.js exports `pdfJsWithWorker` needs. */
export interface PdfJsWorkerModule extends PdfJs {
  /** pdf.js only accepts its own worker objects; the helper never inspects one. */
  getDocument(options: { url: string; worker?: never }): PdfLoadingTask;
  PDFWorker: { fromPort(params: { port: Worker }): { destroy(): void } };
}

/**
 * For bundlers that emit a worker only through `new Worker(new URL(...))`:
 * starts one worker per document with `createWorker`, lets it fail loading
 * instead of hanging when the script cannot start, and terminates it when the
 * viewer releases the document.
 */
export function pdfJsWithWorker(pdfjs: PdfJsWorkerModule, createWorker: () => Worker): PdfJs {
  return {
    TextLayer: pdfjs.TextLayer,
    getDocument(options) {
      const port = createWorker();
      const worker = pdfjs.PDFWorker.fromPort({ port });
      let task: PdfLoadingTask;
      try {
        task = pdfjs.getDocument({ ...options, worker: worker as never });
      } catch (error) {
        // pdf.js rejects some options synchronously (an unparsable URL, say); the worker must not outlive that.
        worker.destroy();
        port.terminate();
        throw error;
      }
      const startup = new Promise<never>((_, reject) => {
        port.addEventListener('error', () => { reject(new Error('The PDF worker could not start.')); });
      });
      return {
        promise: Promise.race([task.promise, startup]),
        async destroy() {
          try {
            await task.destroy();
          } finally {
            worker.destroy();
            port.terminate();
          }
        },
      };
    },
  };
}
