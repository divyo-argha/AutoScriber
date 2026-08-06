import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { formatTime } from '@/lib/format-utils';
import styles from './transcription-viewer.module.css';
import speakerStyles from './speaker-colors.module.css';

interface WarningProps {
  skippedCount: number;
  skippedRanges: [number, number][];
}

export function SkippedChunksWarning({ skippedCount, skippedRanges }: WarningProps) {
  return (
    <AnimatePresence>
      {skippedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={styles.warnBox}
        >
          <AlertTriangle className={styles.warnIcon} />
          <div className={styles.warnInner}>
            <p className={styles.warnTitle}>
              {skippedCount} chunk{skippedCount !== 1 ? 's' : ''} could not be transcribed
            </p>
            <p className={styles.warnText}>
              The following time range{skippedRanges.length !== 1 ? 's' : ''} {skippedRanges.length !== 1 ? 'are' : 'is'} likely missing from this transcript
              {skippedRanges.length > 0 && (
                <span className={styles.warnRange}>: {skippedRanges.map(([start, end]) => `[${formatTime(start)} – ${formatTime(end)}]`).join(', ')}</span>
              )}
              . This usually happens when the free-tier API quota is exhausted mid-run. Try again later, use a different model, or split the file into smaller parts.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LegendProps {
  speakers: string[];
  speakerColors: Record<string, string>;
}

export function SpeakerLegend({ speakers, speakerColors }: LegendProps) {
  return (
    <AnimatePresence>
      {speakers.length > 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={styles.legend}
        >
          {speakers.map((speaker, i) => (
            <motion.div
              key={speaker}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <Badge className={`${styles.legendBadge} ${speakerColors[speaker] || speakerStyles.fallback}`}>
                🎙️ {speaker}
              </Badge>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
