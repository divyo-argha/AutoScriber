import { Clock } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  isProcessing: boolean;
  processingProgress: number;
  isCancelled: boolean;
  isFailed: boolean;
  processingStatus: string;
  estimatedTime: string;
}

export function ProcessingStatusText({ isProcessing, processingProgress, isCancelled, isFailed, processingStatus, estimatedTime }: Props) {
  const title = isProcessing
    ? 'Transcribing Audio'
    : processingProgress === 100
      ? 'Complete!'
      : isCancelled
        ? 'Transcription Cancelled'
        : isFailed
          ? 'Transcription Failed'
          : 'Processing';

  return (
    <div className={styles.statusCenter}>
      <h2 className={styles.statusTitle}>{title}</h2>
      {!isFailed && !isCancelled && (
        <p className={styles.statusText}>{processingStatus}</p>
      )}
      {isProcessing && estimatedTime && (
        <div className={styles.etaRow}>
          <Clock className={styles.iconXs} />
          {estimatedTime}
        </div>
      )}
    </div>
  );
}
