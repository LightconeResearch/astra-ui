import type { Story } from '@ladle/react';
import { useEffect, useState } from 'react';

export default { title: 'Theme' };

const COLOR_TOKENS = [
  'canvas', 'surface', 'surface-raised', 'surface-muted', 'header', 'artifact-paper', 'artifact-ink',
  'text', 'text-muted', 'text-subtle', 'text-faint', 'eyebrow',
  'border-subtle', 'border', 'border-strong',
  'accent', 'accent-soft', 'accent-contrast', 'link', 'focus', 'danger', 'danger-soft',
  'kind-input', 'kind-analysis', 'kind-output', 'kind-decision', 'kind-decision-ink', 'kind-finding', 'kind-insight', 'kind-insight-ink',
  'kind-input-soft', 'kind-analysis-soft', 'kind-output-soft', 'kind-decision-soft', 'kind-finding-soft', 'kind-insight-soft',
].map((name) => `--astra-color-${name}`);

const FONT_TOKENS = ['--astra-font-ui', '--astra-font-body', '--astra-font-heading', '--astra-font-mono'];

function useResolved(tokens: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const root = document.querySelector('.astra-ui');
    if (!root) return;
    const style = getComputedStyle(root);
    setValues(Object.fromEntries(tokens.map((token) => [token, style.getPropertyValue(token).trim()])));
  }, [tokens]);
  return values;
}

/** Every colour token with its resolved value under the active theme. */
export const Colors: Story = () => {
  const values = useResolved(COLOR_TOKENS);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))', gap: '0.75rem' }}>
      {COLOR_TOKENS.map((token) => (
        <div key={token} style={{ display: 'grid', gridTemplateColumns: '3rem 1fr', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ width: '3rem', height: '3rem', background: `var(${token})`, border: '1px solid var(--astra-color-border-strong)' }} />
          <span style={{ fontFamily: 'var(--astra-font-mono)', fontSize: '0.75rem', overflowWrap: 'anywhere' }}>
            {token}
            <br />
            <span style={{ color: 'var(--astra-color-text-subtle)' }}>{values[token]}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

/** The four font roles. */
export const Typography: Story = () => {
  const values = useResolved(FONT_TOKENS);
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {FONT_TOKENS.map((token) => (
        <div key={token}>
          <div style={{ fontFamily: 'var(--astra-font-mono)', fontSize: '0.75rem', color: 'var(--astra-color-text-subtle)' }}>{token} → {values[token]}</div>
          <div style={{ fontFamily: `var(${token})`, fontSize: '1.25rem' }}>The fiducial method performs well across eight tracer bins.</div>
        </div>
      ))}
    </div>
  );
};
