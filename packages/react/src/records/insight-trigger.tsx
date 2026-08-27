import type { ResolvedInsight } from '@astra-spec/sdk';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type Ref } from 'react';
import { recordTitle } from '../data/records.js';
import { cn } from '../lib/cn.js';
import { Prose, type TextRenderer } from '../ui/prose.js';

export function InsightEvidenceTitle({ name, tag }: { name: string; tag?: string | undefined }) {
  return (
    <span className="astra-evidence__title">
      <span className="astra-evidence__glyph--insight" aria-hidden="true">◈</span>
      <span className="astra-evidence__name">{name}</span>
      {tag ? <span className="astra-evidence__tag">{tag}</span> : null}
    </span>
  );
}

export interface InsightTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  insight: ResolvedInsight;
  onOpen: () => void;
  /** Tag shown after the name in the `title` variant; `null` hides it. */
  tag?: string | null | undefined;
  /** `title` shows the name; `claim` shows the full claim text. */
  variant?: 'title' | 'claim' | undefined;
  renderText?: TextRenderer | undefined;
}

/** A clickable reference to an insight, as a title or as its claim. */
export const InsightTrigger = forwardRef<HTMLElement, InsightTriggerProps>(function InsightTrigger({
  insight,
  onOpen,
  tag = 'prior insight',
  variant = 'title',
  renderText,
  className,
  ...props
}, ref) {
  const title = recordTitle(insight);
  if (variant === 'claim') {
    // A div rather than a <button>: block prose inside a button would inherit
    // UA control fonts and shift the layout.
    return (
      <div
        {...(props as HTMLAttributes<HTMLDivElement>)}
        ref={ref as Ref<HTMLDivElement>}
        data-slot="insight-trigger"
        className={cn('astra-insight-trigger', className)}
        data-variant="claim"
        role="button"
        tabIndex={0}
        aria-label={`Open insight details: ${title}`}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        <span className="astra-evidence__glyph--insight" aria-hidden="true">◈</span>
        <div className="astra-insight-trigger__claim">
          <Prose text={insight.claim} field="claim" renderText={renderText} />
        </div>
      </div>
    );
  }
  return (
    <button
      {...props}
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      data-slot="insight-trigger"
      className={cn('astra-insight-trigger', className)}
      data-variant="title"
      aria-label={`Open insight details: ${title}`}
      onClick={onOpen}
    >
      <InsightEvidenceTitle name={title} tag={tag ?? undefined} />
    </button>
  );
});
