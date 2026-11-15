/** Presentation normalization; DOI transport values remain unchanged. */
export function normalizeDoi(value: string): string { return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase(); }
export function doiHref(value: string): string { return `https://doi.org/${normalizeDoi(value)}`; }
