import type { ResolvedInput } from '@astra-spec/sdk';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { DetailLayout, DetailMain, DetailSection } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose, type TextRenderer } from '../primitives/prose.js';

export function inputSourceLabel(record: ResolvedInput): string {
  return record.source ?? record.ref ?? record.resolvedFrom ?? 'Source not declared';
}

export interface InputDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: ResolvedInput;
  renderText?: TextRenderer | undefined;
}

/** Description, the record an alias resolves from, and the declared source of an input. */
export const InputDetail = forwardRef<HTMLDivElement, InputDetailProps>(function InputDetail({
  record,
  renderText,
  className,
  ...props
}, ref) {
  const declared = record.source ?? record.ref;
  const primary = record.resolvedFrom ?? declared ?? 'Source not declared';
  return (
    <DetailLayout data-slot="input-detail" {...props} ref={ref} layout="single" className={className}>
      <DetailMain>
        {record.description ? (
          <DetailSection label="Description" heading="section">
            <Prose text={record.description} field="description" renderText={renderText} />
          </DetailSection>
        ) : null}
        <section className="astra-input-source">
          <h4>{record.resolvedFrom ? 'Resolved from' : 'Source'}</h4>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- long paths scroll horizontally */}
          <code tabIndex={0} title={primary}>{primary}</code>
        </section>
        {record.resolvedFrom && declared ? (
          <section className="astra-input-source">
            <h4>Source</h4>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- long paths scroll horizontally */}
            <code tabIndex={0} title={declared}>{declared}</code>
          </section>
        ) : null}
      </DetailMain>
    </DetailLayout>
  );
});

export interface InputDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'>, Omit<InputDetailProps, 'className'> {}

export function InputDialog({ record, renderText, ...dialog }: InputDialogProps) {
  const labels = useLabels();
  return (
    <DetailDialog
      {...dialog}
      kind="input"
      kindLabel={labels.kinds.input}
      title={recordTitle(record)}
      closeLabel={labels.closeRecord(labels.kinds.input)}
    >
      <InputDetail record={record} renderText={renderText} />
    </DetailDialog>
  );
}
