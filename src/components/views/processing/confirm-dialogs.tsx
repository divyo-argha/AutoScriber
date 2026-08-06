import { Ban, Pause } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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
      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={onCancelOpenChange}
        title="Cancel Transcription?"
        description={
          <>
            Are you sure you want to stop transcribing{' '}
            <strong>{uploadedFileName || 'this audio file'}</strong>? Progress for this job will be
            cancelled immediately.
          </>
        }
        confirmLabel="Cancel Job"
        cancelLabel="Keep Transcribing"
        tone="danger"
        icon={<Ban className="size-5" />}
        onConfirm={onConfirmCancel}
      />
      <ConfirmDialog
        open={confirmPauseOpen}
        onOpenChange={onPauseOpenChange}
        title="Pause Transcription?"
        description="Pause processing at the current segment? You can resume transcription at any time without losing completed progress."
        confirmLabel="Pause Processing"
        cancelLabel="Continue Transcribing"
        tone="warning"
        icon={<Pause className="size-5" />}
        onConfirm={onConfirmPause}
      />
    </>
  );
}
