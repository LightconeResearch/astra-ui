import type { Story } from '@ladle/react';
import { InlineReference } from '@astra-spec/ui/primitives';

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
