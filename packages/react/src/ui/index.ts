/** Presentation primitives: no ASTRA data model beyond record kinds. */
export { cn } from '../lib/cn.js';
export { Slot } from '../lib/slot.js';
export type { SlotProps } from '../lib/slot.js';
export { LabelsProvider, defaultLabels, mergeLabels, useLabels } from '../lib/labels.js';
export type { AstraLabelOverrides, AstraLabels } from '../lib/labels.js';
export { surfaceGlyph } from './kind.js';
export type { SurfaceKind } from './kind.js';
export { Button, IconButton } from './button.js';
export type { ButtonProps, ButtonSize, ButtonTone, ButtonVariant, IconButtonProps } from './button.js';
export { Badge } from './badge.js';
export type { BadgeProps, BadgeStatus, BadgeTone } from './badge.js';
export { SurfaceHeader } from './surface-header.js';
export type { SurfaceHeaderDensity, SurfaceHeaderProps, SurfaceHeadingLevel } from './surface-header.js';
export {
  DetailDialog,
  Dialog,
  DialogAction,
  DialogBack,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogProvider,
  useDialog,
  useDialogDismissGuard,
} from './dialog.js';
export type {
  DetailDialogProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogLayout,
  DialogMode,
  DialogProps,
  DialogProviderProps,
} from './dialog.js';
export { EmptyState, RecordIdentity, RecordList } from './record-list.js';
export type { RecordIdentityProps, RecordListColumn, RecordListProps, RecordListRow } from './record-list.js';
export { RelationList } from './relation-list.js';
export type { RelationItem, RelationListProps } from './relation-list.js';
export { CountHeading, DetailLayout, DetailMain, DetailRail, DetailSection } from './detail-layout.js';
export type { CountHeadingProps, DetailLayoutMode, DetailLayoutProps, DetailRailProps, DetailSectionProps } from './detail-layout.js';
export { Prose } from './prose.js';
export type { ProseContext, ProseField, ProseProps, TextRenderer } from './prose.js';
export {
  ArtifactPreview,
  metricPreviewFromJson,
  tablePreviewFromDelimited,
  tablePreviewFromRows,
} from './artifact-preview.js';
export type {
  ArtifactPreviewData,
  ArtifactPreviewProps,
  ArtifactRenderOptions,
  ArtifactRenderer,
  DelimitedPreviewOptions,
  ImagePreviewData,
  LoadingPreviewData,
  MetricPreviewData,
  TablePreviewData,
  TextPreviewData,
  UnavailablePreviewData,
} from './artifact-preview.js';
