import { cn } from '../lib/cn.js';
import { RecordDialog, type RecordDialogProps } from './record-dialog.js';

export type RecordViewProps = Omit<RecordDialogProps, 'mode' | 'backText' | 'onBack' | 'onClose' | 'showCloseButton'>;

const KEEP_OPEN = (): void => undefined;

/**
 * One record's detail as a page of its own: the RecordDialog chrome in
 * embedded mode, flush with and as tall as its container, without the close
 * control. For hosts that give each record a surface of their own (a tab, a
 * route) and so own its dismissal.
 */
export function RecordView({ className, ...props }: RecordViewProps) {
  return (
    <RecordDialog
      {...props}
      className={cn('astra-record-view', className)}
      mode="embedded"
      showCloseButton={false}
      onClose={KEEP_OPEN}
    />
  );
}
