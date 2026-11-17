import type { Input } from '@astra-spec/sdk/reports';
import { forwardRef, type HTMLAttributes } from 'react';
import { recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import { DetailLayout, DetailMain, DetailSection } from '../primitives/detail-layout.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import { Prose } from '../primitives/prose.js';
import type { TextRenderer } from '../lib/prose.js';

export interface InputDetailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  record: Input;
  renderText?: TextRenderer | undefined;
}

/** Description and repository path of an input. */
export const InputDetail = forwardRef<HTMLDivElement, InputDetailProps>(function InputDetail({
  record,
  renderText,
  className,
  ...props
}, ref) {
  return (
    <DetailLayout data-slot="input-detail" {...props} ref={ref} layout="single" className={className}>
      <DetailMain>
        {record.description ? (
          <DetailSection label="Description" heading="section">
            <Prose text={record.description} field="description" renderText={renderText} />
          </DetailSection>
        ) : null}
        <section className="astra-input-source">
          <h4>Source</h4>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- long paths scroll horizontally */}
          <code tabIndex={0} title={record.path}>{record.path}</code>
        </section>
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
