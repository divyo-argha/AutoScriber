import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Wifi, Cpu, AlertTriangle, Settings, Download, RotateCw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import styles from './processing-view.module.css';

interface Props {
  isLocationError: boolean;
  isAuthError: boolean;
  processingStatus: string;
  onGoBack: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onResume?: (modelId?: string) => void;
  selectedModel?: string;
  onDownloadPartial: () => void;
  canDownload: boolean;
}

export function ErrorPanel({ 
  isLocationError, 
  isAuthError, 
  processingStatus, 
  onGoBack, 
  onOpenSettings, 
  onRetry,
  onResume,
  selectedModel,
  onDownloadPartial,
  canDownload
}: Props) {
  const [modelChoice, setModelChoice] = useState(selectedModel || 'gemini-2.0-flash');
  const availableModels = useAppStore(s => s.availableModels);

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
          <Button variant="brand" className={styles.btnGap} onClick={onOpenSettings}>
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
          <Button variant="brand" className={styles.btnGap} onClick={onOpenSettings}>
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
          <p className={styles.messageTitle}>Transcription Stopped / Failed</p>
          <p className={styles.messageSub}>{processingStatus.replace(/^(Failed|Error):\s*/, '')}</p>
        </div>
      </div>

      <div className={styles.pausedModelSelector}>
        <p className={styles.pausedModelLabel}>Switch model or API key to resume without losing completed progress:</p>
        <select
          className={styles.modelSelect}
          value={modelChoice}
          onChange={(e) => setModelChoice(e.target.value)}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actionRow}>
        <Button variant="outline" onClick={onGoBack}>
          Go Back
        </Button>
        {canDownload && (
          <Button variant="outline" onClick={onDownloadPartial}>
            <Download className={styles.iconSm} style={{ marginRight: '6px' }} /> Partial Text
          </Button>
        )}
        {onResume && (
          <Button variant="brand" onClick={() => onResume(modelChoice)}>
            <RotateCw className={styles.iconSm} style={{ marginRight: '6px' }} /> Resume Job
          </Button>
        )}
        <Button variant="ghost" onClick={onRetry} style={{ fontSize: '0.75rem' }}>
          Start Over
        </Button>
      </div>
    </div>
  );
}
