import { Loader2, CheckCircle2, XCircle, Ban } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  isProcessing: boolean;
  processingProgress: number;
  isCancelled: boolean;
  isFailed: boolean;
}

export function ProcessingIcon({ isProcessing, processingProgress, isCancelled, isFailed }: Props) {
  if (isProcessing) {
    return (
      <div className={styles.spinnerWrap}>
        <div className={styles.pulseRing} />
        <Loader2 className={`${styles.bigIcon} ${styles.iconGreen} ${styles.spinner}`} />
      </div>
    );
  }
  if (processingProgress === 100) {
    return (
      <div className={`${styles.iconBox} ${styles.iconBoxGreen}`}>
        <CheckCircle2 className={`${styles.bigIcon} ${styles.iconGreen}`} />
      </div>
    );
  }
  if (isCancelled) {
    return (
      <div className={`${styles.iconBox} ${styles.iconBoxAmber}`}>
        <Ban className={`${styles.bigIcon} ${styles.iconAmber}`} />
      </div>
    );
  }
  if (isFailed) {
    return (
      <div className={`${styles.iconBox} ${styles.iconBoxDestructive}`}>
        <XCircle className={`${styles.bigIcon} ${styles.iconDestructive}`} />
      </div>
    );
  }
  return (
    <div className={`${styles.iconBox} ${styles.iconBoxMuted}`}>
      <Loader2 className={`${styles.bigIcon} ${styles.iconMuted} ${styles.spinner}`} />
    </div>
  );
}
