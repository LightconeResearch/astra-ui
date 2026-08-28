/** Joins class names, skipping falsy values. astra-ui has no utility classes to dedupe, so no runtime dependency is needed. */
export function cn(...inputs: (string | false | null | undefined)[]): string | undefined {
  const joined = inputs.filter(Boolean).join(' ');
  return joined || undefined;
}
