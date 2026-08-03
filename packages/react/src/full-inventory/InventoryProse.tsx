/**
 * A deliberately small prose renderer for inventory metadata strings.
 *
 * The normal ASTRA report keeps using StoreProse and MyST's renderer registry.
 * The inventory snapshot carries plain strings rather than parsed MyST nodes,
 * so this renders the inline code and math forms used by ASTRA metadata without
 * mounting a second document pipeline.
 */
import * as React from 'react';

export type InventoryProseToken =
  | { type: 'text'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'math'; value: string };

/** Balanced tokens: display math first, then `code`, then inline math. */
const PROSE_TOKEN = /(\$\$[\s\S]+?\$\$|`[^`\n]+`|\$[^$\n]+\$)/g;

export function parseInventoryProse(text: string): InventoryProseToken[] {
  const nodes: InventoryProseToken[] = [];
  let last = 0;
  for (const match of text.matchAll(PROSE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push({ type: 'text', value: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('$$')) {
      nodes.push({ type: 'math', value: token.slice(2, -2).trim() });
    } else if (token.startsWith('`')) {
      nodes.push({ type: 'inlineCode', value: token.slice(1, -1) });
    } else {
      nodes.push({ type: 'inlineMath', value: token.slice(1, -1) });
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

export const InventoryProse: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  if (!/[`$]/.test(text)) return <>{text}</>;
  return (
    <>
      {parseInventoryProse(text).map((node, index) => {
        if (node.type === 'inlineCode') return <code key={index}>{node.value}</code>;
        if (node.type === 'inlineMath') {
          return (
            <span key={index} className="inventory-prose__inline-math">
              {node.value}
            </span>
          );
        }
        if (node.type === 'math') {
          return (
            <div key={index} className="inventory-prose__display-math">
              {node.value}
            </div>
          );
        }
        return <React.Fragment key={index}>{node.value}</React.Fragment>;
      })}
    </>
  );
};

export default InventoryProse;
