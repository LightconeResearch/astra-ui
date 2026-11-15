import type { OutputContext } from '../model/output-status.js';
import type { ReactNode } from 'react';
import type { Output, Result, Status } from '@astra-spec/sdk/reports';
import type { OutputRelations } from '../model/relations.js';
import { isVisualOutput, recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import type { TextRenderer } from '../lib/prose.js';
import { OutputDetail, OutputDialogActions } from './output-detail.js';
import { useOutputExpanded } from '../lib/use-output-expanded.js';
import type { OpenRecordHandler } from '../lib/detail-stack.js';

export interface OutputDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'> {
  record: Output;
  result?: Result | undefined;
  status?: Status | undefined;
  universeRef?: string | undefined;
  relations: OutputRelations;
  renderArtifact?: ArtifactRenderer | undefined;
  /** Host renderer for recorded output provenance, shown below Recipe. */
  renderProvenance?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  /** Host-provided link to the current code file, shown beside Recipe. */
  renderCodeLink?: ((output: Output, context: OutputContext) => ReactNode) | undefined;
  renderText?: TextRenderer | undefined;
  onOpenArtifact?: ((output: Output) => void | Promise<void>) | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  expanded?: boolean | undefined;
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}

export function OutputDialog({
  record: output,
  result,
  status,
  universeRef,
  relations,
  renderArtifact,
  renderProvenance,
  renderCodeLink,
  renderText,
  onOpenArtifact,
  onOpenRecord,
  expanded: controlledExpanded,
  onExpandedChange,
  ...dialog
}: OutputDialogProps) {
  const labels = useLabels();
  const [expanded, setExpanded] = useOutputExpanded(output, { expanded: controlledExpanded, onExpandedChange });
  return (
    <DetailDialog
      {...dialog}
      kind="output"
      layout={isVisualOutput(output) ? 'reader' : undefined}
      kindLabel={output.type}
      title={recordTitle(output)}
      closeLabel={labels.closeRecord(labels.kinds.output)}
      actions={(
        <OutputDialogActions
          record={output}
          onOpenArtifact={onOpenArtifact}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      )}
    >
      <OutputDetail
        record={output}
        relations={relations}
        result={result}
        status={status}
        universeRef={universeRef}
        renderArtifact={renderArtifact}
        renderProvenance={renderProvenance}
        renderCodeLink={renderCodeLink}
        renderText={renderText}
        onOpenRecord={onOpenRecord}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    </DetailDialog>
  );
}
