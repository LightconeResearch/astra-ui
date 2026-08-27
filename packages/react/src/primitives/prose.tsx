import { Fragment, type ReactNode } from 'react';
import { renderToString } from 'katex';

export type ProseField = 'claim' | 'rationale' | 'description' | 'notes' | 'quote';

export interface ProseContext {
  /** Which authored field is being rendered, when known. */
  field?: ProseField | undefined;
}

/** Host-owned rendering for authored prose (Markdown, citations, ...); replaces the built-in rendering. */
export type TextRenderer = (text: string, context: ProseContext) => ReactNode;

export type ProseToken =
  | { type: 'text'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'math'; value: string };

/** Balanced tokens: display math first, then `code`, then inline math. */
const PROSE_TOKEN = /(\$\$[\s\S]+?\$\$|`[^`\n]+`|\$[^$\n]+\$)/g;

/** Splits authored prose into text, inline `code`, `$inline$` and `$$display$$` math. */
export function parseProse(text: string): ProseToken[] {
  const nodes: ProseToken[] = [];
  let last = 0;
  for (const match of text.matchAll(PROSE_TOKEN)) {
    const index = match.index;
    if (index > last) nodes.push({ type: 'text', value: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('$$')) nodes.push({ type: 'math', value: token.slice(2, -2).trim() });
    else if (token.startsWith('`')) nodes.push({ type: 'inlineCode', value: token.slice(1, -1) });
    else nodes.push({ type: 'inlineMath', value: token.slice(1, -1) });
    last = index + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

function renderMath(value: string, displayMode: boolean): string {
  return renderToString(value, { displayMode, output: 'htmlAndMathml', strict: 'ignore', throwOnError: false });
}

/**
 * The built-in rendering: inline `code`, and `$inline$` / `$$display$$` math
 * typeset with KaTeX (load `katex/dist/katex.css`; the stylesheet bundles
 * import it). Text without those markers is returned as is.
 */
export function renderProse(text: string): ReactNode {
  if (!/[`$]/.test(text)) return text;
  return parseProse(text).map((node, index) => {
    switch (node.type) {
      case 'inlineCode':
        return <code key={index}>{node.value}</code>;
      case 'inlineMath':
        return <span key={index} className="astra-prose__inline-math" dangerouslySetInnerHTML={{ __html: renderMath(node.value, false) }} />;
      case 'math':
        return <div key={index} className="astra-prose__display-math" dangerouslySetInnerHTML={{ __html: renderMath(node.value, true) }} />;
      default:
        return <Fragment key={index}>{node.value}</Fragment>;
    }
  });
}

export interface ProseProps extends ProseContext {
  text?: string | undefined;
  renderText?: TextRenderer | undefined;
}

/** Authored prose: the host's `renderText` when given, otherwise `renderProse`. */
export function Prose({ text, field, renderText }: ProseProps) {
  if (!text) return null;
  return <>{renderText ? renderText(text, { field }) : renderProse(text)}</>;
}
