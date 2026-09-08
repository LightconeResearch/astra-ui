import type { Story } from '@ladle/react';
import { InlineReference, KindGlyph } from '@astra-spec/ui/primitives';

export default { title: 'Editorial' };

export const InlineReferences: Story = () => (
  <div style={{ maxWidth: 640, font: '17px/1.72 var(--astra-font-body)' }}>
    <p>
      The <InlineReference kind="input">catalogue</InlineReference> supports our{' '}
      <InlineReference kind="decision">method choice</InlineReference> and{' '}
      <InlineReference kind="finding">headline finding</InlineReference>.
    </p>
    <p>
      Compare the <InlineReference kind="prior_insight">published method</InlineReference>,{' '}
      <InlineReference kind="output">result figure</InlineReference> and{' '}
      <InlineReference kind="analysis">sub-analysis</InlineReference>.
    </p>
    <p>
      The result is <InlineReference kind="value">0.42 ± 0.03</InlineReference>.{' '}
      <em>Italic prose uses a bundled face.</em> <code>catalogue.fits</code>
    </p>
  </div>
);

/** The surrounding label size/colour must not redefine a kind's identity. */
export const KindGlyphs: Story = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    {(['analysis', 'input', 'decision', 'output', 'finding', 'prior_insight', 'paper'] as const).map(kind => (
      <div key={kind} style={{ display: 'grid', gridTemplateColumns: '240px 240px', alignItems: 'baseline' }}>
        <span style={{ font: '17px/1.72 var(--astra-font-body)' }}>
          <InlineReference kind={kind}>{kind}</InlineReference>
        </span>
        <span data-kind="output" style={{ color: 'var(--astra-color-text-subtle)', font: '11px/1.4 var(--astra-font-ui)' }}>
          <KindGlyph kind={kind} /> {kind} in a compact viewer row
        </span>
      </div>
    ))}
  </div>
);
