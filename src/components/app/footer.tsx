'use client';

import styles from './footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <p className={styles.text}>
            autoScriber — Bangla Audio Transcription for Researchers
          </p>
          <p className={styles.text}>
            Powered by Gemini &amp; Soniox
          </p>
        </div>
      </div>
    </footer>
  );
}
