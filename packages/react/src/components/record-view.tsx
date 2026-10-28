import { RecordDialog, type RecordDialogProps } from './record-dialog.js';

export type RecordViewProps = Omit<RecordDialogProps, 'mode' | 'backText' | 'onBack' | 'onClose' | 'showCloseButton'>;

const KEEP_OPEN = (): void => undefined;

/**
 * One record's detail as part of the page rather than over it: the
 * RecordDialog chrome in embedded mode, without the close control. For hosts
 * that give each record a surface of their own (a tab, a route) and so own
 * its dismissal.
 */
export function RecordView(props: RecordViewProps) {
  return <RecordDialog {...props} mode="embedded" showCloseButton={false} onClose={KEEP_OPEN} />;
}
