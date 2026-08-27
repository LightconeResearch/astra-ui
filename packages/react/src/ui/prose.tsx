import type { ReactNode } from 'react';

export type ProseField = 'claim' | 'rationale' | 'description' | 'notes' | 'quote';

export interface ProseContext {
  /** Which authored field is being rendered, when known. */
  field?: ProseField | undefined;
}

/** Host-owned rendering for authored prose (Markdown, math, citations). Plain text is the portable default. */
export type TextRenderer = (text: string, context: ProseContext) => ReactNode;

export interface ProseProps extends ProseContext {
  text?: string | undefined;
  renderText?: TextRenderer | undefined;
}

export function Prose({ text, field, renderText }: ProseProps) {
  if (!text) return null;
  return <>{renderText ? renderText(text, { field }) : text}</>;
}
