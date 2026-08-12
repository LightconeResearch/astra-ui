import {
  ArtifactPreview,
  inventoryFileExtension,
  inventoryFileName,
  useResourcePreview,
} from '../artifact-preview.js';
import type { InventoryOutputRecord } from '../types.js';

const TABLE_PREVIEW_DISPLAY_ROWS = 30;
const TABLE_PREVIEW_DISPLAY_COLUMNS = 30;

export function InventoryArtifactPreview({
  record,
  compact = false,
}: {
  record: InventoryOutputRecord;
  compact?: boolean | undefined;
}) {
  const { output, state, resource, missingReason } = useResourcePreview({
    output: record,
    maxRows: TABLE_PREVIEW_DISPLAY_ROWS,
    maxColumns: TABLE_PREVIEW_DISPLAY_COLUMNS,
  });
  return (
    <ArtifactPreview
      variant="inventory"
      output={output}
      {...(state.status === 'ready'
        && (state.preview.kind !== 'unavailable' || missingReason)
        ? { preview: state.preview }
        : {})}
      {...(resource ? { resource } : {})}
      compact={compact}
    />
  );
}

export { inventoryFileExtension, inventoryFileName };
