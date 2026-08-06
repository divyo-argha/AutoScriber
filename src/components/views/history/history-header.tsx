import { Button } from '@/components/ui/button';
import { History, Loader2 } from 'lucide-react';
import styles from './history-view.module.css';

interface HistoryHeaderProps {
  completedCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export function HistoryHeader({ completedCount, loading, onRefresh }: HistoryHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.title}>
          <History className={styles.titleIcon} />
          Transcription History
        </h2>
        <p className={styles.subtitle}>
          {completedCount} completed transcription{completedCount !== 1 ? 's' : ''} saved
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} className={styles.btnGap}>
        <Loader2 className={`${styles.iconSm} ${loading ? styles.spinIcon : styles.hidden}`} />
        {!loading && 'Refresh'}
      </Button>
    </div>
  );
}
