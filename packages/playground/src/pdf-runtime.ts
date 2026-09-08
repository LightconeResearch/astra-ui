import { pdfJsWithWorker, type PdfJsLoader } from '@astra-spec/ui/lib';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/**
 * The reference adapter. The legacy build and its matching worker polyfill the
 * package's browser floor (Promise.withResolvers among others) in both realms.
 * pdf.js starts one worker per open document from this URL and terminates it
 * when the viewer releases the document.
 */
export const loadPdfJs: PdfJsLoader = async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
};

/** The same runtime for builds that can only start a worker themselves. */
export const loadPdfJsWithWorker: PdfJsLoader = async () => pdfJsWithWorker(
  await import('pdfjs-dist/legacy/build/pdf.mjs'),
  () => new Worker(workerUrl, { type: 'module' }),
);
