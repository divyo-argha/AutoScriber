import { Button } from '@/components/ui/button';
import { Upload, FolderOpen } from 'lucide-react';
import { ACCEPTED_AUDIO_EXTENSIONS } from '@/lib/file';
import { TabCard } from './tab-card';
import styles from './upload-area.module.css';

interface DropzoneProps {
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (files: FileList) => void;
  onBrowse: () => void;
}

export function UploadDropzone({ isDragging, onDragStart, onDragEnd, onDrop, onBrowse }: DropzoneProps) {
  return (
    <TabCard
      className={isDragging ? styles.dropZoneActive : undefined}
      onDragOver={(e) => { e.preventDefault(); onDragStart(); }}
      onDragLeave={(e) => { e.preventDefault(); onDragEnd(); }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
        if (e.dataTransfer.files.length > 0) onDrop(e.dataTransfer.files);
      }}
    >
      <div className={styles.dropIconWrap}>
        <Upload className={styles.dropIcon} />
      </div>
      <div>
        <p className={styles.dropTitle}>Drop audio files here</p>
        <p className={styles.dropSubtitle}>Single or multiple files supported</p>
      </div>
      <Button variant="outline" onClick={onBrowse} className={styles.gap2}>
        <FolderOpen className={styles.iconMd} /> Choose Files
      </Button>
      <p className={styles.hint}>MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, WMA — up to 2GB each</p>
    </TabCard>
  );
}
