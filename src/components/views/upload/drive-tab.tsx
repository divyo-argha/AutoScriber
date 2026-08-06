import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Cloud, Loader2, FileAudio, Download } from 'lucide-react';
import styles from './upload-area.module.css';

interface DriveFile {
  id: string;
  name: string;
}

interface DriveTabProps {
  driveLoading: boolean;
  driveFiles: DriveFile[];
  driveSelected: Set<string>;
  onConnect: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onToggleFile: (id: string, checked: boolean) => void;
}

export function DriveTab({ driveLoading, driveFiles, driveSelected, onConnect, onDownload, onCancel, onToggleFile }: DriveTabProps) {
  return (
    <Card className={styles.dropZone}>
      <div className={styles.dropInner}>
        <div className={styles.sourceIconWrap}>
          <Cloud className={styles.sourceIcon} />
        </div>
        {driveFiles.length === 0 ? (
          <>
            <div>
              <p className={styles.dropTitle}>Google Drive</p>
              <p className={styles.dropSubtitle}>Connect and select audio files</p>
            </div>
            <Button onClick={onConnect} disabled={driveLoading} className={styles.gap2}>
              {driveLoading ? <Loader2 className={`${styles.iconMd} ${styles.spinner}`} /> : <Cloud className={styles.iconMd} />}
              {driveLoading ? 'Connecting...' : 'Connect Google Drive'}
            </Button>
          </>
        ) : (
          <>
            <div className={styles.driveList}>
              {driveFiles.map(f => (
                <label key={f.id} className={styles.driveRow}>
                  <Checkbox
                    checked={driveSelected.has(f.id)}
                    onCheckedChange={(checked) => onToggleFile(f.id, checked === true)}
                  />
                  <FileAudio className={styles.fileRowIcon} />
                  <span className={styles.fileRowName}>{f.name}</span>
                </label>
              ))}
            </div>
            <div className={styles.driveActions}>
              <Button variant="outline" size="sm" onClick={onCancel} className={styles.driveBtn}>
                Cancel
              </Button>
              <Button size="sm" onClick={onDownload} disabled={driveLoading || driveSelected.size === 0} className={styles.downloadBtn}>
                {driveLoading ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Download className={styles.iconSm} />}
                Download ({driveSelected.size})
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
