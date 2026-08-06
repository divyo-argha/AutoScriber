import { Button } from '@/components/ui/button';
import { Pause, Play, Ban, Loader2 } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  isProcessing: boolean;
  paused: boolean;
  cancelling: boolean;
  onPauseResume: () => void;
  onRequestCancel: () => void;
}

export function ProcessingControls({ isProcessing, paused, cancelling, onPauseResume, onRequestCancel }: Props) {
  if (!isProcessing) return null;

  return (
    <>
      <div className={styles.controls}>
        <Button
          variant={paused ? 'brand' : 'outline'}
          size="sm"
          onClick={onPauseResume}
          disabled={cancelling}
          className={styles.controlBtn}
        >
          {paused ? <Play className={styles.iconSm} /> : <Pause className={styles.iconSm} />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onRequestCancel}
          disabled={cancelling}
          className={styles.controlBtn}
        >
          {cancelling ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Ban className={styles.iconSm} />}
          {cancelling ? 'Cancelling...' : 'Cancel'}
        </Button>
      </div>
      {paused && isProcessing && (
        <p className={styles.pausedHint}>
          Paused — the current chunk finishes, then transcription holds until you press Resume.
        </p>
      )}
    </>
  );
}
