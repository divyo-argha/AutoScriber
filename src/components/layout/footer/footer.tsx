'use client';

import { Mic, ShieldCheck } from 'lucide-react';
import styles from './footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <p className={styles.brand}>
            <Mic className={styles.brandIcon} />
            <span>
              <span className={styles.brandName}>autoScriber</span> — Bangla Audio Transcription for Researchers
            </span>
          </p>
          <p className={styles.text}>
            <ShieldCheck className={styles.textIcon} />
            Powered by Gemini &amp; Vertex AI
          </p>
        </div>
      </div>
    </footer>
  );
}
