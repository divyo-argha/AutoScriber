'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi } from 'lucide-react';
import type { TestStatus } from './use-settings-form';
import styles from './settings-view.module.css';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  status: TestStatus;
  onTest: () => void;
}

export function ApiKeyInput({ value, onChange, showKey, onToggleShow, status, onTest }: ApiKeyInputProps) {
  return (
    <div className={styles.geminiField}>
      <Label className={styles.advLabel}>API Key</Label>
      <div className={styles.keyRow}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="AIzaSy..."
            value={value}
            onChange={e => onChange(e.target.value)}
            className={styles.keyInput}
            style={{ paddingRight: '2.5rem' }}
          />
          <button
            type="button"
            onClick={onToggleShow}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showKey ? <EyeOff className={styles.iconSm} /> : <Eye className={styles.iconSm} />}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={onTest} disabled={status === 'testing'} className={styles.testKeyBtn}>
          {status === 'testing' ? (
            <>
              <Loader2 className={`${styles.iconSm} ${styles.spin}`} />
              Testing…
            </>
          ) : (
            <>
              <Wifi className={styles.iconSm} />
              Test Key
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
