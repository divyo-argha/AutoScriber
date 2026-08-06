import { motion, AnimatePresence } from 'framer-motion';
import styles from './processing-view.module.css';

interface Props {
  isProcessing: boolean;
  processingProgress: number;
  chunksTotal: number;
}

const STEPS = [
  { label: 'Upload audio', done: (p: number) => p > 0 },
  { label: 'Split into chunks', done: (p: number, c: number) => c > 0 },
  { label: 'Transcribe chunks', done: (p: number) => p > 50 },
  { label: 'Assemble results', done: (p: number) => p === 100 },
];

export function ProcessingSteps({ isProcessing, processingProgress, chunksTotal }: Props) {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className={styles.steps}
        >
          {STEPS.map((step, i) => {
            const done = step.done(processingProgress, chunksTotal);
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={styles.stepRow}
              >
                <motion.div
                  animate={{
                    backgroundColor: done ? '#10b981' : 'rgba(120,120,120,0.3)',
                    scale: done ? [1, 1.3, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={styles.stepDot}
                />
                <span className={done ? styles.stepDone : styles.stepPending}>{step.label}</span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
