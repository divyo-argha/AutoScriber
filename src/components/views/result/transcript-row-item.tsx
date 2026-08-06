import { useState, useMemo, memo } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { calculateWordTimings } from '@/lib/word-timing';
import { formatTime } from '@/lib/format-utils';
import styles from './transcription-viewer.module.css';
import speakerStyles from './speaker-colors.module.css';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

interface TranscriptRowItemProps {
  segment: TranscriptionSegment;
  idx: number;
  speakerColor: string;
  onClick: (time: number) => void;
  activeSegmentRef?: React.Ref<HTMLDivElement>;
}

export const TranscriptRowItem = memo(function TranscriptRowItem({
  segment,
  idx,
  speakerColor,
  onClick,
  activeSegmentRef,
}: TranscriptRowItemProps) {
  const activeSegmentIndex = useAppStore(s => s.activeSegmentIndex);
  const currentTime = useAppStore(s => s.currentTime);

  const isActive = idx === activeSegmentIndex;
  const isPast = currentTime > segment.endTime;
  const segmentWordTimings = useMemo(() => {
    return isActive ? calculateWordTimings(segment.text, segment.startTime, segment.endTime) : [];
  }, [isActive, segment.text, segment.startTime, segment.endTime]);

  return (
    <motion.div
      ref={isActive ? activeSegmentRef : null}
      variants={fadeUp}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(segment.startTime)}
      className={`${styles.row} ${isActive ? styles.rowActive : isPast ? styles.rowPast : styles.rowFuture}`}
    >
      <div className={styles.timeCol}>
        <span className={`${styles.timeText} ${isActive ? styles.timeActive : styles.timeInactive}`}>
          {formatTime(segment.startTime).split('.')[0]}
        </span>
      </div>

      <div className={styles.speakerCol}>
        <Badge className={`${styles.speakerPill} ${speakerColor || speakerStyles.fallback}`}>
          {segment.speaker}
        </Badge>
      </div>

      <div className={styles.body}>
        {isActive && segmentWordTimings.length > 0 ? (
          <p className={styles.wordText}>
            {segmentWordTimings.map((wordTiming, wordIdx) => {
              const isCurrentWord = currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime;
              const isWordPast = currentTime > wordTiming.endTime;

              return (
                <span
                  key={wordIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(wordTiming.startTime);
                  }}
                  className={`${styles.word} ${isCurrentWord ? styles.wordCurrent : isWordPast ? styles.wordPast : styles.wordFuture}`}
                >
                  {wordTiming.word}
                </span>
              );
            })}
          </p>
        ) : (
          <p className={`${styles.segText} ${isActive ? styles.segActive : isPast ? styles.segPast : styles.segFuture}`}>
            {segment.text}
          </p>
        )}
      </div>
    </motion.div>
  );
});
