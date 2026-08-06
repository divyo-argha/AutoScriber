import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Ban, Pause } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  uploadedFileName: string;
  confirmCancelOpen: boolean;
  confirmPauseOpen: boolean;
  onCancelOpenChange: (open: boolean) => void;
  onPauseOpenChange: (open: boolean) => void;
  onConfirmCancel: () => void;
  onConfirmPause: () => void;
}

export function ConfirmDialogs({
  uploadedFileName,
  confirmCancelOpen,
  confirmPauseOpen,
  onCancelOpenChange,
  onPauseOpenChange,
  onConfirmCancel,
  onConfirmPause,
}: Props) {
  return (
    <>
      <Dialog open={confirmCancelOpen} onOpenChange={onCancelOpenChange}>
        <DialogContent className={styles.dialogContentSm}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitleDestructive}>
              <Ban className={styles.dialogTitleIcon} />
              Cancel Transcription?
            </DialogTitle>
            <DialogDescription className={styles.dialogDesc}>
              Are you sure you want to stop transcribing <strong>{uploadedFileName || 'this audio file'}</strong>? Progress for this job will be cancelled immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => onCancelOpenChange(false)}>
              Keep Transcribing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onCancelOpenChange(false);
                onConfirmCancel();
              }}
            >
              Cancel Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmPauseOpen} onOpenChange={onPauseOpenChange}>
        <DialogContent className={styles.dialogContentSm}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <Pause className={styles.dialogTitleIconAmber} />
              Pause Transcription?
            </DialogTitle>
            <DialogDescription className={styles.dialogDesc}>
              Pause processing at the current segment? You can resume transcription at any time without losing completed progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => onPauseOpenChange(false)}>
              Continue Transcribing
            </Button>
            <Button
              className={styles.amberPrimary}
              onClick={() => {
                onPauseOpenChange(false);
                onConfirmPause();
              }}
            >
              Pause Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
