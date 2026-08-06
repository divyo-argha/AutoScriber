import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Files, X, FileAudio, FolderOpen, Play, Loader2 } from 'lucide-react';
import { formatFileSize } from '@/lib/file';
import styles from './upload-area.module.css';

interface PendingFilesCardProps {
  files: File[];
  checking: boolean;
  onClearAll: () => void;
  onRemoveFile: (index: number) => void;
  onAddMore: () => void;
  onStart: () => void;
}

export function PendingFilesCard({ files, checking, onClearAll, onRemoveFile, onAddMore, onStart }: PendingFilesCardProps) {
  return (
    <Card>
      <div className={styles.pendingInner}>
        <div className={styles.pendingHeader}>
          <p className={styles.pendingTitle}>
            <Files className={styles.pendingTitleIcon} />
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          <Button variant="ghost" size="sm" onClick={onClearAll} className={styles.clearBtn}>
            <X className={styles.iconXs} /> Clear all
          </Button>
        </div>
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <div key={i} className={styles.fileRow}>
              <FileAudio className={styles.fileRowIcon} />
              <span className={styles.fileRowName}>{f.name}</span>
              <span className={styles.fileRowSize}>{formatFileSize(f.size)}</span>
              <button onClick={() => onRemoveFile(i)} className={styles.fileRowRemove}>
                <X className={styles.iconXs} />
              </button>
            </div>
          ))}
        </div>
        <div className={styles.fileFooter}>
          <Button variant="outline" size="sm" onClick={onAddMore} className={styles.btnSmall}>
            <FolderOpen className={styles.iconSm} /> Add more
          </Button>
          <div className={styles.spacer} />
          <Button size="sm" variant="brand" onClick={onStart} disabled={checking}>
            {checking ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Play className={styles.iconSm} />}
            {checking ? 'Checking...' : `Transcribe ${files.length} files`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
