// Generates packages/react/TOKENS.md from styles/tokens.css so the token
// contract cannot drift from the stylesheet.
//
//   node scripts/tokens-doc.mjs
//
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync(new URL('../packages/react/styles/tokens.css', import.meta.url), 'utf8');
const ruleBody = (marker) => {
  const selector = css.indexOf(marker);
  if (selector < 0) throw new Error(`Missing token rule: ${marker}`);
  const start = css.indexOf('{', selector) + 1;
  let depth = 1;
  let end = start;
  while (depth && end < css.length) {
    if (css[end] === '{') depth += 1;
    else if (css[end] === '}') depth -= 1;
    end += 1;
  }
  if (depth) throw new Error(`Unclosed token rule: ${marker}`);
  return css.slice(start, end - 1);
};
const parse = (body) => Object.fromEntries([...body.matchAll(/^\s*(--astra-[a-z0-9-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name, value.trim()]));
const light = parse(ruleBody(':where(.astra-ui) {'));
const dark = parse(ruleBody(':where(.astra-ui[data-astra-color-scheme="dark"])'));
const groups = [
  ['Surfaces', /^--astra-color-(canvas|surface|header|artifact)/],
  ['Text', /^--astra-color-(text|eyebrow)/],
  ['Borders', /^--astra-color-border/],
  ['Interaction', /^--astra-color-(accent|link|focus|danger)/],
  ['Record kinds', /^--astra-color-kind/],
  ['Kind indirection', /^--astra-kind/],
  ['Typography', /^--astra-font/],
  ['Geometry', /^--astra-(radius|shadow|space|width|z)/],
];
let out = '# astra-ui token contract\n\nGenerated from `styles/tokens.css` by `scripts/tokens-doc.mjs`; do not edit by hand.\n\nEvery token is declared on `:where(.astra-ui)` at zero specificity in the `astra.tokens` layer. The bundled values are independent, brand-neutral fallbacks so the package remains usable on its own; external themes map their primitives onto these semantic roles under an explicit opt-in scope. Override tokens on the `.astra-ui` root with a later or unlayered rule, or on a descendant for a narrower scope; normal cascade and inheritance rules apply. Set `data-astra-color-scheme="light"` or `"dark"` on `.astra-ui`; `"dark"` selects the built-in dark palette and `"light"` uses the base palette. Leaving the attribute unset also uses the base palette. The package does not inspect host theme state: integrations map their host theme to this attribute and update it when that theme changes.\n\n';
for (const [title, pattern] of groups) {
  const names = Object.keys(light).filter((name) => pattern.test(name));
  if (!names.length) continue;
  out += `## ${title}\n\n| Token | Light default | Dark default |\n| --- | --- | --- |\n`;
  for (const name of names) out += `| \`${name}\` | \`${light[name]}\` | ${dark[name] ? `\`${dark[name]}\`` : '—'} |\n`;
  out += '\n';
}
writeFileSync(new URL('../packages/react/TOKENS.md', import.meta.url), out);
console.log(`${Object.keys(light).length} tokens documented`);
