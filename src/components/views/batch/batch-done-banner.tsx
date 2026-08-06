import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Archive } from 'lucide-react';
import styles from './batch-view.module.css';

interface BatchDoneBannerProps {
  doneCount: number;
  onDownloadAll: () => void;
}

export function BatchDoneBanner({ doneCount, onDownloadAll }: BatchDoneBannerProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className={styles.doneBanner}>
        <div className={styles.doneBannerRow}>
          <div>
            <p className={styles.doneTitle}>{doneCount} transcriptions ready</p>
            <p className={styles.doneSub}>Each file includes TXT, SRT, and Markdown</p>
          </div>
          <Button variant="brand" className={styles.btnGap} onClick={onDownloadAll}>
            <Archive className={styles.iconMd} />
            Download All as ZIP
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
