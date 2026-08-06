'use client';

import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './settings-view.module.css';

interface SettingsFooterProps {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function SettingsFooter({ saving, onCancel, onSave }: SettingsFooterProps) {
  return (
    <div className={styles.footer}>
      <p className={styles.footerHint}>
        Changes take effect for all future transcription jobs.
      </p>
      <div className={styles.footerBtns}>
        <Button variant="ghost" size="sm" onClick={onCancel} className={styles.cancelBtn}>
          Cancel
        </Button>
        <Button size="sm" variant="brand" onClick={onSave} disabled={saving} className={styles.saveBtn}>
          {saving ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Check className={styles.iconSm} />}
          Save & Apply Settings
        </Button>
      </div>
    </div>
  );
}
