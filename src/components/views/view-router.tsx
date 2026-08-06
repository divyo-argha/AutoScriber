'use client';

import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from '@/components/error-boundary';
import { UploadArea } from './upload';
import { ProcessingView } from './processing';
import { TranscriptionViewer } from './result';
import styles from './view-router.module.css';

export function ViewRouter() {
  const { currentView } = useAppStore();

  return (
    <AnimatePresence mode="wait">
      {currentView === 'upload' && (
        <motion.div
          key="upload"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className={styles.uploadSection}
        >
          <ErrorBoundary fallbackTitle="The upload area hit a snag">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className={styles.hero}
            >
              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeDot} />
                Free, no account required
              </div>
              <h2 className={styles.heroTitle}>
                Transcribe Your <span className={styles.heroTitleAccent}>Bangla Audio</span>
              </h2>
              <p className={styles.heroSub}>
                Upload an audio file or record directly from your browser. Get accurate Bangla-English mixed transcriptions with
                timestamps and speaker diarization. Built for researchers.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
            >
              <UploadArea />
            </motion.div>
          </ErrorBoundary>
        </motion.div>
      )}
      {currentView === 'processing' && (
        <motion.div
          key="processing"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
        >
          <ErrorBoundary fallbackTitle="The processing view hit a snag">
            <ProcessingView />
          </ErrorBoundary>
        </motion.div>
      )}
      {currentView === 'result' && (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ErrorBoundary fallbackTitle="The transcript view hit a snag">
            <TranscriptionViewer />
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
