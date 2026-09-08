import { renderProse, type ProseContext, type TextRenderer } from '../lib/prose.js';

export interface ProseProps extends ProseContext {
  text?: string | undefined;
  renderText?: TextRenderer | undefined;
}

/** Authored prose: the host's `renderText` when given, otherwise `renderProse`. */
export function Prose({ text, field, renderText }: ProseProps) {
  if (!text) return null;
  return <>{renderText ? renderText(text, { field }) : renderProse(text)}</>;
}
