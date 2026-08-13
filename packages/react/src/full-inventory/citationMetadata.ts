const DOI_URL_PREFIX = /^https?:\/\/(?:dx\.)?doi\.org\//i;
const DOI_LABEL_PREFIX = /^doi:\s*/i;

export function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(DOI_LABEL_PREFIX, '')
    .replace(DOI_URL_PREFIX, '')
    .trim()
    .toLowerCase();
}

export function doiHref(value: string): string {
  return `https://doi.org/${normalizeDoi(value)}`;
}

function decodeHtmlText(html: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (match, entity: string) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const value = Number.parseInt(
        entity.slice(hexadecimal ? 2 : 1),
        hexadecimal ? 16 : 10,
      );
      return Number.isSafeInteger(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a title from MyST's default APA bibliography HTML.
 *
 * Journal article titles are the text after the parenthesized year and before
 * the first italicized container title. For books and reports, the title itself
 * is commonly the first italicized field.
 */
export function citationTitleFromHtml(html: unknown): string | undefined {
  if (typeof html !== 'string') return undefined;
  const firstItalic = /<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
  const firstLink = /<a\b/i.exec(html);
  const boundary = [firstItalic?.index, firstLink?.index]
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right)[0];
  const beforeText = decodeHtmlText(
    boundary === undefined ? html : html.slice(0, boundary),
  );
  const year = /\((?:\d{4}[a-z]?|n\.d\.)\)\.?\s*/i.exec(beforeText);
  if (!year) return undefined;

  const articleTitle = beforeText
    .slice((year.index ?? 0) + year[0].length)
    .replace(/^[\s.:;–—-]+/, '')
    .replace(/[\s.]+$/, '')
    .trim();
  if (articleTitle) return articleTitle;

  const italicTitle = firstItalic ? decodeHtmlText(firstItalic[2] ?? '') : '';
  return italicTitle || undefined;
}
