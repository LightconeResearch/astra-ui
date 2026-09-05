/** Structural PDF.js types and the portable quote-matching pipeline. */
export interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PdfTextContent {
  items: { str?: string }[];
}

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PdfPageProxy {
  getTextContent: () => Promise<PdfTextContent>;
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: Record<string, unknown>) => PdfRenderTask;
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

export interface PdfLoadingTask {
  promise: Promise<PDFDocumentProxy>;
  destroy: () => Promise<void>;
}

export interface PdfTextLayer {
  render: () => Promise<void>;
  cancel: () => void;
  textDivs: HTMLElement[];
  textContentItemsStr: string[];
}

export interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string; workerPort: Worker | null };
  getDocument: (options: { url: string }) => PdfLoadingTask;
  TextLayer: new (options: {
    textContentSource: PdfTextContent;
    container: HTMLElement;
    viewport: PdfViewport;
  }) => PdfTextLayer;
}

interface MatchOrigin {
  itemIndex: number;
  rawStart: number;
  rawEnd: number;
}

export interface QuoteMatch {
  origin: MatchOrigin[];
  start: number;
  length: number;
}

function normalizeChar(character: string): string {
  if (character === '\u00ad' || '-‐‑‒–—―'.includes(character)) return '';
  if ('‘’‚‛'.includes(character)) return "'";
  if ('“”„‟'.includes(character)) return '"';
  return character.toLowerCase();
}

export function normalizeQuote(value: string): { aggressive: string; withSpaces: string } {
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

export function findQuoteMatch(strings: string[], quote: string): QuoteMatch | undefined {
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

export function highlightMatch(
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
    mark.className = 'astra-paper-pdf__match';
    mark.textContent = raw.slice(range.rawStart, range.rawEnd);
    textDiv.append(mark);
    if (range.rawEnd < raw.length) textDiv.append(document.createTextNode(raw.slice(range.rawEnd)));
    firstMark ??= mark;
  }
  return firstMark;
}

export function pageStrings(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  cache: Map<number, Promise<string[]>>,
): Promise<string[]> {
  const cached = cache.get(pageNumber);
  if (cached) return cached;
  const pending = pdf.getPage(pageNumber)
    .then((page) => page.getTextContent())
    .then((content) => content.items.map((item) => item.str ?? ''));
  cache.set(pageNumber, pending);
  void pending.catch(() => cache.delete(pageNumber));
  return pending;
}

export async function pageStringsWithTimeout(
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
          () => { reject(new Error(`Timed out extracting PDF page ${pageNumber}.`)); },
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
