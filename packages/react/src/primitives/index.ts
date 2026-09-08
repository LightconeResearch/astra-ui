/** Presentation primitives: generic UI with no ASTRA model beyond record kinds. */
export { Slot } from './slot.js';
export type { SlotProps } from './slot.js';
export { Button, IconButton } from './button.js';
export type { ButtonProps, ButtonSize, ButtonTone, ButtonVariant, IconButtonProps } from './button.js';
export { PreviewPopover } from './preview-popover.js';
export type {
  PreviewPopoverPortalProps,
  PreviewPopoverProps,
} from './preview-popover.js';
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
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogProvider,
  useDialog,
  useDialogDismissGuard,
} from './dialog.js';
export type {
  DetailDialogProps,
  DialogActionProps,
  DialogBackProps,
  DialogCloseProps,
  DialogContentProps,
  DialogContextValue,
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
export type { ProseProps } from './prose.js';
export { KindGlyph } from './kind-glyph.js';
export type { KindGlyphProps } from './kind-glyph.js';
export { InlineReference } from './inline-reference.js';
export type { InlineReferenceProps } from './inline-reference.js';
