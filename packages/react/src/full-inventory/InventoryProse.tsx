import type { ReactNode } from 'react';

/** Host-owned rendering for authored prose. Plain text is the portable default. */
export type TextRenderer = (text: string) => ReactNode;

export interface InventoryProseProps {
  text?: string | undefined;
  renderText?: TextRenderer | undefined;
}

export function InventoryProse({ text, renderText }: InventoryProseProps) {
  if (!text) return null;
  return <>{renderText ? renderText(text) : text}</>;
}
