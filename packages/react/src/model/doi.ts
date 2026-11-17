const DOI_LABEL_PREFIX = /^doi:\s*/i;
const DOI_URL_PREFIX = /^https?:\/\/(?:dx\.)?doi\.org\//i;

/**
 * Presentation normalization; DOI transport values remain unchanged. The label
 * comes off before the resolver URL, so `doi: https://doi.org/…` normalizes too.
 */
export function normalizeDoi(value: string): string {
  return value.trim().replace(DOI_LABEL_PREFIX, '').replace(DOI_URL_PREFIX, '').trim().toLowerCase();
}
export function doiHref(value: string): string { return `https://doi.org/${normalizeDoi(value)}`; }
