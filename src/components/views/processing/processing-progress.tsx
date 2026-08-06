import { Progress } from '@/components/ui/progress';
import styles from './processing-view.module.css';

interface Props {
  processingProgress: number;
  chunksTotal: number;
  chunksDone: number;
  processingStatus: string;
}

export function ProcessingProgressBar({ processingProgress, chunksTotal, chunksDone, processingStatus }: Props) {
  return (
    <div className={styles.progressGroup}>
      <div className={styles.progressHeader}>
        <span>Progress</span>
        <span>
          {processingProgress}%
          {chunksTotal > 0 && (
            <span className={styles.chunkMeta}>
              ({Math.min(chunksDone, chunksTotal)}/{chunksTotal} Chunks)
            </span>
          )}
        </span>
      </div>
      <Progress value={processingProgress} className={styles.progressBar} />
      <div className={styles.statusRow}>
        <span className={styles.statusRowText}>Status: {processingStatus}</span>
      </div>
    </div>
  );
}
