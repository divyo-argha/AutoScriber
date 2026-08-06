import { Button } from '@/components/ui/button';
import { Loader2, FileAudio, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './history-view.module.css';

export function HistoryLoading() {
  return (
    <div className={styles.loadingWrap}>
      <Loader2 className={styles.loadingIcon} />
      <p className={styles.loadingText}>Loading history...</p>
    </div>
  );
}

export function HistoryEmpty({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={styles.emptyWrap}
    >
      <FileAudio className={styles.emptyIcon} />
      <p className={styles.emptyText}>No transcriptions yet.</p>
      <p className={styles.emptyHint}>Your completed transcriptions will appear here.</p>
      <Button variant="outline" onClick={onStart} className={styles.btnGap}>
        <Play className={styles.iconSm} />
        Start Your First Transcription
      </Button>
    </motion.div>
  );
}
