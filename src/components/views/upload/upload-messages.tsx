import { AlertCircle, Globe } from 'lucide-react';
import styles from './upload-area.module.css';

export function UploadError({ message }: { message: string }) {
  return (
    <div className={styles.errorBox}>
      <AlertCircle className={styles.errorIcon} />
      <span>{message}</span>
    </div>
  );
}

export function UploadWarning({ message }: { message: string }) {
  return (
    <div className={styles.warningBox}>
      <Globe className={styles.warningIcon} />
      <p>{message}</p>
    </div>
  );
}
