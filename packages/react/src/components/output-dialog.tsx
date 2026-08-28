import type { ResolvedOutput } from '@astra-spec/sdk';
import type { OutputRelations } from '../model/relations.js';
import { isVisualOutput, recordTitle } from '../model/records.js';
import { useLabels } from '../lib/labels.js';
import type { ArtifactRenderer } from './artifact-preview.js';
import { DetailDialog, type DetailDialogProps } from '../primitives/dialog.js';
import type { TextRenderer } from '../primitives/prose.js';
import { OutputDetail, OutputDialogActions, useOutputExpanded } from './output-detail.js';
import type { OpenRecordHandler } from './relation-items.js';

export interface OutputDialogProps extends Pick<DetailDialogProps, 'mode' | 'backText' | 'className' | 'onBack' | 'onClose'> {
  record: ResolvedOutput;
  relations: OutputRelations;
  renderArtifact?: ArtifactRenderer | undefined;
  renderText?: TextRenderer | undefined;
  onOpenArtifact?: ((output: ResolvedOutput) => void | Promise<void>) | undefined;
  onOpenRecord?: OpenRecordHandler | undefined;
  expanded?: boolean | undefined;
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}

export function OutputDialog({
  record: output,
  relations,
  renderArtifact,
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
        renderArtifact={renderArtifact}
        renderText={renderText}
        onOpenRecord={onOpenRecord}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    </DetailDialog>
  );
}
