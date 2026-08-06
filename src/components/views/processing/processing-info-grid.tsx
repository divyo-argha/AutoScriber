import { FileAudio, Cloud, Cpu } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  uploadedFileName: string;
  modelName: string;
  modelProvider: string;
  selectedModel: string;
}

export function ProcessingInfoGrid({ uploadedFileName, modelName, modelProvider, selectedModel }: Props) {
  return (
    <div className={styles.infoGrid}>
      <div className={styles.infoItem}>
        <FileAudio className={styles.infoIcon} />
        <div className={styles.infoInner}>
          <p className={styles.infoName}>{uploadedFileName}</p>
          <p className={styles.infoLabel}>Audio File</p>
        </div>
      </div>
      <div className={styles.infoItem}>
        {modelProvider === 'gemini' ? (
          <Cloud className={styles.infoIcon} />
        ) : (
          <Cpu className={styles.infoIcon} />
        )}
        <div className={styles.infoInner}>
          <p className={styles.infoName}>{modelName || selectedModel}</p>
          <p className={styles.infoLabel}>
            {modelProvider === 'gemini' ? 'Cloud API' : 'Local Model'}
          </p>
        </div>
      </div>
    </div>
  );
}
