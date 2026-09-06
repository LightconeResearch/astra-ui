import type { PdfJsLoader } from '@astra-spec/ui/components';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** A bundler-hosted runtime with a separate worker for each open document. */
export const loadPdfJs: PdfJsLoader = async () => {
  // The legacy pair includes polyfills needed by the UI's browser floor,
  // including Promise.withResolvers in both the window and worker realms.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return {
    createTextLayer(options: ConstructorParameters<typeof pdfjs.TextLayer>[0]) {
      return new pdfjs.TextLayer(options);
    },
    getDocument(options) {
      const worker = new Worker(workerUrl, { type: 'module' });
      const pdfWorker = pdfjs.PDFWorker.fromPort({ port: worker });
      const task = pdfjs.getDocument({ ...options, worker: pdfWorker });
      return {
        promise: task.promise,
        async destroy() {
          try {
            await task.destroy();
          } finally {
            pdfWorker.destroy();
            worker.terminate();
          }
        },
      };
    },
  };
};
