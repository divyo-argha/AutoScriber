import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileAudio, X, Play, Loader2 } from 'lucide-react';
import { formatFileSize } from '@/lib/file';
import styles from './upload-area.module.css';

interface SelectedFileCardProps {
  fileName: string;
  fileSize: number;
  checking: boolean;
  onRemove: () => void;
  onStart: () => void;
}

export function SelectedFileCard({ fileName, fileSize, checking, onRemove, onStart }: SelectedFileCardProps) {
  return (
    <Card className={styles.uploadCard}>
      <div className={styles.uploadCardInner}>
        <div className={styles.fileIconWrap}>
          <FileAudio className={styles.fileIcon} />
        </div>
        <div>
          <p className={styles.fileName}>{fileName}</p>
          <p className={styles.fileMeta}>{formatFileSize(fileSize)}</p>
        </div>
        <div className={styles.ctaRow}>
          <Button variant="outline" size="sm" onClick={onRemove} className={styles.btnGap}>
            <X className={styles.iconSm} /> Remove
          </Button>
          <Button size="sm" variant="brand" onClick={onStart} disabled={checking}>
            {checking ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Play className={styles.iconSm} />}
            {checking ? 'Checking...' : 'Start Transcription'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
