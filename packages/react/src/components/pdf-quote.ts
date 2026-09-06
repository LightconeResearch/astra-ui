import type { PdfDocument, PdfTextContent } from './pdf-runtime.js';

/** A passage to locate in a PDF: its quoted text and/or the cited one-based physical page. */
export interface PdfPassage {
  /** Distinguishes requests; repeat a passage under a new key to scroll to it again. */
  key: string;
  quote?: string | undefined;
  page?: number | undefined;
}

/** The page a passage was found on; `match` is absent for a cited-page fallback. */
export interface PdfPassageLocation {
  page: number;
  match?: QuoteMatch | undefined;
}

interface MatchOrigin {
  itemIndex: number;
  rawStart: number;
  rawEnd: number;
}

/** Where a quote sits in a page's text runs: offsets into the folded text, each mapped back to its raw run. */
export interface QuoteMatch {
  origin: MatchOrigin[];
  start: number;
  length: number;
  /** False when only a shortened prefix of the quote was found. */
  complete: boolean;
}

/**
 * Text content per page of one open document, shared by the text layers and
 * passage search so each page is extracted once. There is no timeout: an
 * extraction that never settles means the worker is gone, and rendering has
 * stopped with it.
 */
export type PdfTextCache = Map<number, Promise<PdfTextContent>>;

export function pageText(pdf: PdfDocument, page: number, cache: PdfTextCache): Promise<PdfTextContent> {
  const cached = cache.get(page);
  if (cached) return cached;
  const attempt = pdf.getPage(page).then((value) => value.getTextContent());
  cache.set(page, attempt);
  // A failed extraction is forgotten so a later request can retry it.
  void attempt.catch(() => cache.delete(page));
  return attempt;
}

export function textStrings(content: PdfTextContent): string[] {
  return content.items.flatMap((item) => (
    typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string'
      ? [item.str]
      : []
  ));
}

const DASHES = '-‐‑‒–—―';
const SINGLE_QUOTES = '‘’‚‛';
const DOUBLE_QUOTES = '“”„‟';

/**
 * The comparable form of one code point: compatibility forms (ligatures, full
 * width) decompose; accents and other marks, dashes, whitespace and invisible
 * format characters (soft hyphens, zero-width spaces and joiners, invisible
 * operators) vanish; case folds. Extracted text then matches an authored quote
 * whether the PDF kept, decomposed or lost its diacritics.
 */
function fold(codePoint: string): string {
  let folded = '';
  for (const part of codePoint.normalize('NFKD')) {
    if (/[\s\p{M}\p{Cf}]/u.test(part) || DASHES.includes(part)) continue;
    folded += SINGLE_QUOTES.includes(part) ? "'" : DOUBLE_QUOTES.includes(part) ? '"' : part.toLowerCase();
  }
  return folded;
}

function foldWords(quote: string): string[] {
  const words: string[] = [];
  let word = '';
  for (const codePoint of quote) {
    if (/\s/u.test(codePoint)) {
      if (word) words.push(word);
      word = '';
    } else {
      word += fold(codePoint);
    }
  }
  if (word) words.push(word);
  return words;
}

/**
 * Finds a quote in a page's text runs, keeping raw offsets for highlighting.
 * The whole quote wins; otherwise the longest word prefix of at least 16
 * characters is reported as a partial match.
 */
export function findQuoteMatch(strings: string[], quote: string): QuoteMatch | undefined {
  let flat = '';
  const origin: MatchOrigin[] = [];
  strings.forEach((raw, itemIndex) => {
    let rawStart = 0;
    for (const codePoint of raw) {
      const rawEnd = rawStart + codePoint.length;
      const folded = fold(codePoint);
      flat += folded;
      origin.push(...Array.from({ length: folded.length }, () => ({ itemIndex, rawStart, rawEnd })));
      // A combining mark stays with its base, so a highlight boundary never splits the glyph.
      const base = origin.at(-1);
      if (!folded && base?.itemIndex === itemIndex && /\p{M}/u.test(codePoint)) base.rawEnd = rawEnd;
      rawStart = rawEnd;
    }
  });

  const words = foldWords(quote);
  const full = words.join('');
  if (!full) return undefined;
  const probes = [full];
  for (let count = words.length - 1; count > 0; count -= 1) {
    const probe = words.slice(0, count).join('');
    if (probe.length < 16) break;
    probes.push(probe);
  }
  for (const probe of probes) {
    const start = flat.indexOf(probe);
    if (start !== -1) return { origin, start, length: probe.length, complete: probe === full };
  }
  return undefined;
}

/** Wraps the matched characters of a rendered text layer in `<mark>` elements and returns the first. */
export function highlightMatch(strings: string[], textDivs: HTMLElement[], match: QuoteMatch): HTMLElement | undefined {
  const ranges = new Map<number, { rawStart: number; rawEnd: number }>();
  for (let index = match.start; index < match.start + match.length; index += 1) {
    const item = match.origin[index];
    if (!item) continue;
    const range = ranges.get(item.itemIndex);
    if (range) {
      range.rawStart = Math.min(range.rawStart, item.rawStart);
      range.rawEnd = Math.max(range.rawEnd, item.rawEnd);
    } else {
      ranges.set(item.itemIndex, { rawStart: item.rawStart, rawEnd: item.rawEnd });
    }
  }
  let first: HTMLElement | undefined;
  for (const [itemIndex, range] of ranges) {
    const textDiv = textDivs[itemIndex];
    if (!textDiv) continue;
    const raw = strings[itemIndex] ?? '';
    const mark = document.createElement('mark');
    mark.className = 'astra-paper-pdf__match';
    mark.textContent = raw.slice(range.rawStart, range.rawEnd);
    textDiv.replaceChildren(raw.slice(0, range.rawStart), mark, raw.slice(range.rawEnd));
    first ??= mark;
  }
  return first;
}

/** Cited page first; a complete match anywhere outranks a partial one; a valid cited page is the last resort. */
export async function locateQuote(
  pdf: PdfDocument,
  passage: Pick<PdfPassage, 'quote' | 'page'>,
  cache: PdfTextCache,
  signal: AbortSignal,
): Promise<PdfPassageLocation | undefined> {
  const { quote, page: cited } = passage;
  const fallback = cited !== undefined && Number.isInteger(cited) && cited >= 1 && cited <= pdf.numPages
    ? { page: cited }
    : undefined;
  if (!quote) return fallback;
  const order = [...new Set([
    ...(fallback ? [fallback.page] : []),
    ...Array.from({ length: pdf.numPages }, (_, index) => index + 1),
  ])];
  let partial: PdfPassageLocation | undefined;
  for (const page of order) {
    if (signal.aborted) return undefined;
    try {
      const strings = textStrings(await pageText(pdf, page, cache));
      if (signal.aborted) return undefined;
      const match = findQuoteMatch(strings, quote);
      if (match?.complete) return { page, match };
      if (match) partial ??= { page, match };
    } catch {
      // An unreadable page must not stop the search through the rest of the paper.
    }
  }
  return partial ?? fallback;
}
