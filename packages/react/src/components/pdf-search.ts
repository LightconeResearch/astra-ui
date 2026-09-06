import { findQuoteMatch, type QuoteMatch } from './pdf-quote.js';
import { textStrings, type PdfDocument } from './pdf-runtime.js';

export interface PdfQuoteLocation {
  page: number;
  /** Absent for a cited-page fallback. Includes the exact span to highlight. */
  match?: QuoteMatch | undefined;
}

/** One text cache per open document, shared by successive locate requests. */
export type PdfTextCache = Map<number, Promise<string[]>>;

export function pageStrings(
  pdf: PdfDocument,
  page: number,
  cache: PdfTextCache,
  timeoutMs = 10_000,
): Promise<string[]> {
  const cached = cache.get(page);
  if (cached) return cached;
  const pending = new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('PDF text extraction timed out.')); }, timeoutMs);
    void pdf.getPage(page).then((value) => value.getTextContent()).then(textStrings)
      .then(resolve, reject).finally(() => { clearTimeout(timer); });
  });
  cache.set(page, pending);
  void pending.catch(() => { if (cache.get(page) === pending) cache.delete(page); });
  return pending;
}

/** Cited page first; a complete normalized match anywhere outranks a partial. */
export async function locateQuote(
  pdf: PdfDocument,
  quote: string | undefined,
  citedPage: number | undefined,
  cache: PdfTextCache,
  signal: AbortSignal,
): Promise<PdfQuoteLocation | undefined> {
  const validPage = citedPage !== undefined && Number.isInteger(citedPage) && citedPage >= 1 && citedPage <= pdf.numPages;
  if (!quote) return validPage ? { page: citedPage } : undefined;
  const order = [...new Set([
    ...(validPage ? [citedPage] : []),
    ...Array.from({ length: pdf.numPages }, (_, index) => index + 1),
  ])];
  let partial: PdfQuoteLocation | undefined;
  for (const page of order) {
    if (signal.aborted) return undefined;
    try {
      const strings = await pageStrings(pdf, page, cache);
      if (signal.aborted) return undefined;
      const match = findQuoteMatch(strings, quote);
      if (match?.complete) return { page, match };
      if (match) partial ??= { page, match };
    } catch {
      // An unreadable page must not prevent searching the rest of the paper.
    }
  }
  return partial ?? (validPage ? { page: citedPage } : undefined);
}
