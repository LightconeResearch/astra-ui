import type { ResolvedRecord } from '@astra-spec/sdk';

/** Record kinds plus the two non-record surfaces the UI colours. */
export type SurfaceKind = ResolvedRecord['kind'] | 'analysis' | 'paper';

const SURFACE_GLYPHS: Record<SurfaceKind, string> = {
  analysis: '◐',
  input: '↳',
  decision: '◇',
  output: '◆',
  finding: '●',
  prior_insight: '◈',
  paper: '▧',
};

/** The glyph that identifies a kind in lists, relations, and headers. */
export function surfaceGlyph(kind: SurfaceKind): string {
  return SURFACE_GLYPHS[kind];
}
