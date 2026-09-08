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

export type InventorySectionId = 'outputs' | 'decisions' | 'inputs' | 'findings' | 'prior_insights' | 'papers';

/** The record kind each inventory section lists; drives the outline glyph and colour. */
export function sectionKind(section: InventorySectionId): SurfaceKind {
  switch (section) {
    case 'outputs': return 'output';
    case 'decisions': return 'decision';
    case 'inputs': return 'input';
    case 'findings': return 'finding';
    case 'prior_insights': return 'prior_insight';
    case 'papers': return 'paper';
  }
}
