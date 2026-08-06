'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './settings-view.module.css';

interface ConnectionStatusProps {
  variant: 'success' | 'error';
  title: string;
  children?: ReactNode;
}

/** Reusable success/error banner used by both the Vertex and Gemini tabs. */
export function ConnectionStatus({ variant, title, children }: ConnectionStatusProps) {
  const isSuccess = variant === 'success';
  return (
    <div className={isSuccess ? styles.successCard : styles.errorCard}>
      <div className={isSuccess ? styles.successHead : styles.errorHead}>
        {isSuccess ? (
          <CheckCircle2 className={styles.successIcon} />
        ) : (
          <XCircle className={styles.errorIcon} />
        )}
        <div>
          <p className={styles.errorTitle}>{title}</p>
          {children && <p className={styles.errorBody}>{children}</p>}
        </div>
      </div>
    </div>
  );
}
