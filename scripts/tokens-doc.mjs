// Generates packages/react/TOKENS.md from styles/tokens.css so the token
// contract cannot drift from the stylesheet.
//
//   node scripts/tokens-doc.mjs
//
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync(new URL('../packages/react/styles/tokens.css', import.meta.url), 'utf8');
const blocks = [...css.matchAll(/:where\(([^{]+)\)[^{]*\{([\s\S]*?)\n {2}\}/g)];
const parse = (body) => Object.fromEntries([...body.matchAll(/^\s*(--astra-[a-z0-9-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name, value.trim()]));
const light = parse(blocks[0][2]);
const dark = parse(blocks.slice(1).map((b) => b[2]).join('\n'));
const groups = [
  ['Surfaces', /^--astra-color-(canvas|surface|header|artifact)/],
  ['Text', /^--astra-color-(text|eyebrow)/],
  ['Borders', /^--astra-color-border/],
  ['Interaction', /^--astra-color-(accent|link|focus|danger)/],
  ['Record kinds', /^--astra-color-kind/],
  ['Kind indirection', /^--astra-kind/],
  ['Typography', /^--astra-font/],
  ['Geometry', /^--astra-(radius|shadow|space|z)/],
];
let out = '# astra-ui token contract\n\nGenerated from `styles/tokens.css` by `scripts/tokens-doc.mjs`; do not edit by hand.\n\nEvery token is declared on `:where(.astra-ui)` at zero specificity, so a theme redefines it on `.astra-ui` (or any ancestor) and always wins. Dark values apply under `.astra-ui[data-astra-color-scheme="dark"]`, or automatically when JupyterLab or VS Code report a dark theme.\n\n';
for (const [title, pattern] of groups) {
  const names = Object.keys(light).filter((name) => pattern.test(name));
  if (!names.length) continue;
  out += `## ${title}\n\n| Token | Light default | Dark default |\n| --- | --- | --- |\n`;
  for (const name of names) out += `| \`${name}\` | \`${light[name]}\` | ${dark[name] ? `\`${dark[name]}\`` : '—'} |\n`;
  out += '\n';
}
writeFileSync(new URL('../packages/react/TOKENS.md', import.meta.url), out);
console.log(`${Object.keys(light).length} tokens documented`);
