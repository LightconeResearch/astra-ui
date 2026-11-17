import type { Decision, Insight } from '@astra-spec/sdk/reports';
import { forwardRef, useId, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { CountHeading, DetailLayout, DetailMain, DetailSection } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose } from '../primitives/prose.js';
import type { TextRenderer } from '../lib/prose.js';
import { InsightTrigger } from './insight-trigger.js';

export interface DecisionDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: Decision;
  selectedOptionId?: string | undefined;
  /** Insights cited by the decision's options; see `decisionInsights()`. */
  insights: Insight[];
  renderText?: TextRenderer | undefined;
  onOpenInsight?: ((insight: Insight) => void) | undefined;
}

/** Rationale, options with the selected one marked, and the insights that informed the decision. */
export const DecisionDetail = forwardRef<HTMLDivElement, DecisionDetailProps>(function DecisionDetail({
  record,
  selectedOptionId,
  insights,
  renderText,
  onOpenInsight,
  className,
  ...props
}, ref) {
  const optionsId = useId();
  return (
    <DetailLayout data-slot="decision-detail" {...props} ref={ref} layout="single" className={className}>
      <DetailMain>
        {record.rationale ? (
          <DetailSection label="Rationale" heading="section">
            <Prose text={record.rationale} field="rationale" renderText={renderText} />
          </DetailSection>
        ) : null}
        <section className="astra-decision-options" aria-labelledby={optionsId}>
          <h4 id={optionsId}>Options</h4>
          <ul>
            {record.options.map((option) => {
              const selected = option.id === selectedOptionId;
              return (
                <li key={option.id} {...(selected ? { 'data-selected': '' } : {})}>
                  <span className="astra-decision-options__marker" aria-hidden="true">
                    {selected ? '●' : '○'}
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <code>{option.id}</code>
                  </span>
                  {selected ? <small>Selected</small> : null}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="astra-insight-list">
          <CountHeading title="Insights that informed this" count={insights.length} />
          {insights.length ? (
            <ul className="astra-decision-insights">
              {insights.map((insight) => (
                <li key={insight.ref}>
                  <InsightTrigger
                    insight={insight}
                    variant="claim"
                    renderText={renderText}
                    onOpen={() => onOpenInsight?.(insight)}
                  />
                </li>
              ))}
            </ul>
          ) : <p>No prior insights are linked to this decision.</p>}
        </section>
      </DetailMain>
    </DetailLayout>
  );
});

export interface DecisionDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<DecisionDetailProps, 'className'> {}

export function DecisionDialog({ record, selectedOptionId, insights, renderText, onOpenInsight, ...dialog }: DecisionDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="decision"
      kindLabel={labels.kinds.decision}
      title={recordTitle(record)}
      closeLabel={labels.closeRecord(labels.kinds.decision)}
    >
      <DecisionDetail record={record} selectedOptionId={selectedOptionId} insights={insights} renderText={renderText} onOpenInsight={onOpenInsight} />
    </DetailDialog>
  );
}
