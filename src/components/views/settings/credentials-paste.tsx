'use client';

import { AlertTriangle, CheckCircle2, FileJson, Trash2, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CredentialsValidation } from './use-settings-form';
import styles from './settings-view.module.css';

interface CredentialsPasteProps {
  value: string;
  onChange: (value: string) => void;
  validation: CredentialsValidation | null;
  showTip: boolean;
}

export function CredentialsPaste({ value, onChange, validation, showTip }: CredentialsPasteProps) {
  return (
    <div className={styles.pasteGroup}>
      <Label className={styles.pasteLabel}>
        <span className={styles.pasteLabelLeft}>
          <FileJson className={styles.pasteIcon} /> Service Account Key JSON
        </span>
        {value && (
          <button type="button" onClick={() => onChange('')} className={styles.clearBtn}>
            <Trash2 className={styles.iconXs} /> Clear
          </button>
        )}
      </Label>
      <Textarea
        placeholder={`{\n  "type": "service_account",\n  "project_id": "my-gcp-project-123",\n  "client_email": "sa@project.iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "token_uri": "https://oauth2.googleapis.com/token"\n}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={styles.pasteTextarea}
      />
      {validation && !validation.valid && (
        <div className={styles.jsonBad}>
          <p className={styles.jsonHintErr}>
            <XCircle className={styles.iconXs} /> {validation.error}
          </p>
          {validation.missingFields.length > 0 && (
            <div className={styles.jsonFieldChips}>
              {validation.missingFields.map(field => (
                <span key={field} className={styles.jsonChip}>
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {validation?.valid && (
        <div className={styles.jsonBad}>
          <p className={styles.jsonHintOk}>
            <CheckCircle2 className={styles.iconXs} /> Valid service account JSON — Project:{' '}
            <code className={styles.credCode}>{validation.projectId}</code>, Account:{' '}
            <code className={styles.credCode}>{validation.clientEmail}</code>
          </p>
          {validation.warnings?.map(warning => (
            <p key={warning} className={styles.jsonWarn}>
              <AlertTriangle className={styles.iconXs} /> {warning}
            </p>
          ))}
        </div>
      )}
      {!value && showTip && (
        <p className={styles.jsonHint}>
          <FileJson className={styles.iconXs} /> Tip: download the key from GCP Console → IAM → Service Accounts → Keys → Add Key → JSON.
        </p>
      )}
    </div>
  );
}
