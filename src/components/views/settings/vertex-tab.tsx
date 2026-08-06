'use client';

import { Check, CheckCircle2, Lock, Loader2, ShieldCheck, Wifi, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CredentialsPaste } from './credentials-paste';
import { ConnectionStatus } from './connection-status';
import type { CredentialsValidation, GcpStatus, TestStatus, VertexSuccess } from './use-settings-form';
import styles from './settings-view.module.css';

interface VertexTabProps {
  gcpStatus: GcpStatus | null;
  gcpLocation: string;
  onLocationChange: (value: string) => void;
  gcpCredentialsJson: string;
  onCredentialsJsonChange: (value: string) => void;
  jsonValidation: CredentialsValidation | null;
  vertexStatus: TestStatus;
  vertexSuccess: VertexSuccess | null;
  vertexError: string;
  onTest: () => void;
}

export function VertexTab({
  gcpStatus,
  gcpLocation,
  onLocationChange,
  gcpCredentialsJson,
  onCredentialsJsonChange,
  jsonValidation,
  vertexStatus,
  vertexSuccess,
  vertexError,
  onTest,
}: VertexTabProps) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadRow}`}>
          <div className={styles.cardHeadLeft}>
            <div className={`${styles.cardHeadIcon} ${styles.cardHeadIconBrand}`}>
              <ShieldCheck className={styles.iconMd} />
            </div>
            <div>
              <p className={styles.cardTitle}>Service Account Key & Region</p>
              <p className={styles.cardDesc}>Paste your GCP Service Account JSON key. Project ID is auto-extracted.</p>
            </div>
          </div>
          <div className={styles.regionWrap}>
            <Label className={`${styles.projLabel} ${styles.regionLabel}`}>GCP Region:</Label>
            <Input
              placeholder="us-central1"
              value={gcpLocation}
              onChange={e => onLocationChange(e.target.value)}
              className={`${styles.projInput} ${styles.regionInput}`}
            />
          </div>
        </div>

        {gcpStatus?.exists && (
          <div className={styles.credBanner}>
            <div className={styles.credLeft}>
              <div className={styles.credIconWrap}>
                <CheckCircle2 className={styles.credIcon} />
              </div>
              <div className={styles.credBody}>
                <div className={styles.credTitleRow}>
                  <p className={styles.credTitle}>Detected at {gcpStatus.source}</p>
                  <Badge variant="outline" className={styles.credBadge}>GCP Validated</Badge>
                </div>
                {(gcpStatus?.projectId || gcpStatus?.clientEmail) && (
                  <p className={styles.credMeta}>
                    {gcpStatus?.projectId && <code className={styles.credCode}>{gcpStatus.projectId}</code>}
                    {gcpStatus?.projectId && gcpStatus?.clientEmail && ' • '}
                    {gcpStatus?.clientEmail && <code className={styles.credCode}>{gcpStatus.clientEmail}</code>}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <CredentialsPaste
          value={gcpCredentialsJson}
          onChange={onCredentialsJsonChange}
          validation={jsonValidation}
          showTip={!gcpStatus?.exists}
        />
      </div>

      {/* Test Connection */}
      <div className={styles.testRow}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={vertexStatus === 'testing'}
          className={styles.testBtn}
        >
          {vertexStatus === 'testing' ? (
            <>
              <Loader2 className={`${styles.iconSm} ${styles.spin}`} />
              Testing connection…
            </>
          ) : (
            <>
              <Wifi className={styles.iconSm} />
              Test Vertex AI Connection
            </>
          )}
        </Button>

        {vertexStatus === 'connected' && vertexSuccess && (
          <Badge variant="outline" className={styles.statusBadgeOk}>
            <CheckCircle2 className={styles.statusBadgeIcon} /> Connected
          </Badge>
        )}
        {vertexStatus === 'error' && (
          <Badge variant="outline" className={styles.statusBadgeErr}>
            <XCircle className={styles.statusBadgeIconErr} /> Failed
          </Badge>
        )}
      </div>

      {vertexStatus === 'connected' && vertexSuccess && (
        <ConnectionStatus variant="success" title="Connection Successful">
          Project: <code className={styles.credCode}>{vertexSuccess.projectId}</code> • Region:{' '}
          <code className={styles.credCode}>{vertexSuccess.location}</code> • Model:{' '}
          <code className={styles.credCode}>{vertexSuccess.model}</code>
        </ConnectionStatus>
      )}

      {vertexStatus === 'error' && (
        <ConnectionStatus variant="error" title="Connection Error">
          {vertexError}
        </ConnectionStatus>
      )}

      {/* Privacy card */}
      <div className={styles.privacyCard}>
        <div className={styles.privacyHeader}>
          <div className={styles.privacyTitle}>
            <Lock className={styles.privacyIcon} />
            <span>100% Local Data Sovereignty</span>
          </div>
          <Badge variant="outline" className={styles.privacyBadge}>
            Local Only
          </Badge>
        </div>
        <div className={styles.privacyList}>
          <div className={styles.privacyItem}>
            <Check className={styles.privacyCheck} />
            <span><strong>Local file & DB storage:</strong> Recordings, transcripts, and the SQLite database stay on your machine.</span>
          </div>
          <div className={styles.privacyItem}>
            <Check className={styles.privacyCheck} />
            <span><strong>Zero model training:</strong> Under Google Vertex AI terms, your audio & transcripts are never used to train models.</span>
          </div>
          <div className={styles.privacyItem}>
            <Check className={styles.privacyCheck} />
            <span><strong>Ephemeral transfer:</strong> Audio is sent in-memory over TLS and discarded immediately — no GCS buckets used.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
