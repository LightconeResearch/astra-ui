/** The PDF.js surface the viewer uses. No runtime or worker is imported here. */
export interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

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
  promise: Promise<PdfDocument>;
  /** Abort loading and release this document and any worker owned by this task. */
  destroy(): Promise<void>;
}

export interface PdfTextLayer {
  textDivs: HTMLElement[];
  textContentItemsStr: string[];
  render(): Promise<void>;
  cancel(): void;
}

export interface PdfJs {
  getDocument(options: { url: string }): PdfLoadingTask;
  createTextLayer(options: {
    /** The original getTextContent result, passed through without alteration. */
    textContentSource: object;
    container: HTMLElement;
    viewport: PdfViewport;
  }): PdfTextLayer;
}

/**
 * Supply a stable callback. The host owns module/worker delivery; each
 * getDocument call must return an independently disposable loading task.
 * Import PDF.js inside this callback to keep server rendering browser-free.
 */
export type PdfJsLoader = () => Promise<PdfJs>;

export function textStrings(content: PdfTextContent): string[] {
  return content.items.flatMap((item) => (
    typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string'
      ? [item.str]
      : []
  ));
}
