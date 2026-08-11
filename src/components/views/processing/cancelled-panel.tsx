import { AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './processing-view.module.css';

interface Props {
  chunksDone: number;
  chunksTotal: number;
  onDownloadPartial: () => void;
  canDownload: boolean;
}

export function CancelledPanel({ chunksDone, chunksTotal, onDownloadPartial, canDownload }: Props) {
  const detail = chunksDone > 0
    ? `${chunksDone} of ${chunksTotal} chunk(s) had been transcribed.`
    : 'No chunks were transcribed.';

  return (
    <div className={styles.actionBox}>
      <div className={styles.warningBox}>
        <AlertTriangle className={styles.warningIcon} />
        <div className={styles.messageInner}>
          <p className={styles.messageTitle}>Transcription Cancelled</p>
          <p className={styles.messageSub}>
            The job was cancelled. {detail} No result was saved. Use the New button in the top bar to start another transcription.
          </p>
        </div>
      </div>
      {canDownload && (
        <div className={styles.actionRow}>
          <Button variant="outline" onClick={onDownloadPartial}>
            <Download className={styles.iconSm} style={{ marginRight: '8px' }} /> Download Partial Transcript
          </Button>
        </div>
      )}
    </div>
  );
}
