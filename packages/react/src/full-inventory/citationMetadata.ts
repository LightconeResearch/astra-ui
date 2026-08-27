import { normalizeDoi } from '@astra-spec/sdk';

export function doiHref(value: string): string {
  return `https://doi.org/${normalizeDoi(value)}`;
}
