import { Button } from '@/components/ui/button';
import { Ban, Archive, RotateCcw } from 'lucide-react';
import styles from './batch-view.module.css';

interface BatchHeaderProps {
  doneCount: number;
  totalCount: number;
  failedCount: number;
  anyActive: boolean;
  allFinished: boolean;
  downloadAllDisabled: boolean;
  onStop: () => void;
  onDownloadAll: () => void;
  onNewBatch: () => void;
}

export function BatchHeader({ doneCount, totalCount, failedCount, anyActive, allFinished, downloadAllDisabled, onStop, onDownloadAll, onNewBatch }: BatchHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.title}>Batch Transcription</h2>
        <p className={styles.subtitle}>
          {doneCount}/{totalCount} completed{failedCount > 0 ? ` · ${failedCount} failed` : ''}
        </p>
      </div>
      <div className={styles.headerActions}>
        {anyActive && (
          <Button variant="destructive" size="sm" onClick={onStop} className={styles.btnGap}>
            <Ban className={styles.iconSm} />
            Stop Batch
          </Button>
        )}
        {doneCount > 1 && (
          <Button variant="brand" onClick={onDownloadAll} disabled={downloadAllDisabled} className={styles.btnGap} size="sm">
            <Archive className={styles.iconSm} />
            Download All ZIP
          </Button>
        )}
        {allFinished && (
          <Button variant="outline" size="sm" onClick={onNewBatch} className={styles.btnGap}>
            <RotateCcw className={styles.iconSm} /> New Batch
          </Button>
        )}
      </div>
    </div>
  );
}
