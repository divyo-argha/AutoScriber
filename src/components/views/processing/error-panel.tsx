import { Button } from '@/components/ui/button';
import { Globe, Wifi, Cpu, AlertTriangle, Settings } from 'lucide-react';
import styles from './processing-view.module.css';

interface Props {
  isLocationError: boolean;
  isAuthError: boolean;
  processingStatus: string;
  onGoBack: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
}

export function ErrorPanel({ isLocationError, isAuthError, processingStatus, onGoBack, onOpenSettings, onRetry }: Props) {
  if (isLocationError) {
    return (
      <div className={styles.actionBox}>
        <div className={styles.locationBox}>
          <Globe className={styles.locationIcon} />
          <div className={styles.locationInner}>
            <p className={styles.messageTitle}>Gemini API is not available in your region</p>
            <p className={styles.messageSub}>
              Google restricts the Gemini API in certain countries. You have two options to fix this:
            </p>
            <div className={styles.actionBox}>
              <div className={styles.optionRow}>
                <Wifi className={styles.optionIcon} />
                <div>
                  <p className={styles.optionTitle}>Option 1: Use a Proxy</p>
                  <p className={styles.optionSub}>Set up a proxy URL in Settings → Cloud → API Base URL to route through a supported region.</p>
                </div>
              </div>
              <div className={styles.optionRow}>
                <Cpu className={styles.optionIcon} />
                <div>
                  <p className={styles.optionTitle}>Option 2: Use Local Model</p>
                  <p className={styles.optionSub}>Check your API key in Settings.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.actionRow}>
          <Button variant="outline" onClick={onGoBack}>
            Go Back
          </Button>
          <Button className={`${styles.primaryBtn} ${styles.btnGap}`} onClick={onOpenSettings}>
            <Settings className={styles.iconSm} />
            Open Settings
          </Button>
        </div>
      </div>
    );
  }

  if (isAuthError) {
    return (
      <div className={styles.actionBox}>
        <div className={styles.errorBox}>
          <AlertTriangle className={styles.errorIcon} />
          <div className={styles.messageInner}>
            <p className={styles.messageTitle}>Invalid API Key</p>
            <p className={styles.messageSub}>Your Gemini API key appears to be invalid. Please check your key in Settings and try again.</p>
          </div>
        </div>
        <div className={styles.actionRow}>
          <Button variant="outline" onClick={onGoBack}>
            Go Back
          </Button>
          <Button className={`${styles.primaryBtn} ${styles.btnGap}`} onClick={onOpenSettings}>
            <Settings className={styles.iconSm} />
            Open Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actionBox}>
      <div className={styles.errorBox}>
        <AlertTriangle className={styles.errorIcon} />
        <div className={styles.messageInner}>
          <p className={styles.messageTitle}>Transcription Failed</p>
          <p className={styles.messageSub}>{processingStatus.replace(/^(Failed|Error):\s*/, '')}</p>
        </div>
      </div>
      <div className={styles.actionRow}>
        <Button variant="outline" onClick={onGoBack}>
          Go Back
        </Button>
        <Button className={styles.primaryBtn} onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
