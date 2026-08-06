'use client';

import { useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { calculateWordTimings } from '@/lib/word-timing';
import { formatTime } from '@/lib/format-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Quote } from 'lucide-react';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import styles from './focus-player.module.css';
import speakerStyles from './speaker-colors.module.css';

interface FocusPlayerProps {
  segments: TranscriptionSegment[];
  speakerColors: Record<string, string>;
}

export function FocusPlayer({ segments, speakerColors }: FocusPlayerProps) {
  const { currentTime, activeSegmentIndex, isPlaying } = useAppStore();
  const currentSegmentRef = useRef<HTMLDivElement | null>(null);

  // Fallback to first segment if activeSegmentIndex is -1 but audio is loaded
  const displayIndex = activeSegmentIndex === -1 ? 0 : activeSegmentIndex;
  const segment = segments[displayIndex];

  // Calculate word timings for current segment
  const wordTimings = useMemo(() => {
    if (!segment) return [];
    return calculateWordTimings(segment.text, segment.startTime, segment.endTime);
  }, [segment]);

  // Click handler to seek to a specific word
  const handleWordClick = (startTime: number) => {
    useAppStore.getState().seekTo(startTime);
  };

  if (!segment) {
    return (
      <Card className={styles.emptyCard}>
        <Headphones className={styles.emptyIcon} />
        <p className={styles.emptyText}>Select audio to begin playback</p>
      </Card>
    );
  }

  return (
    <Card className={styles.playerCard}>

      {/* Immersive pulsing background mesh that responds to isPlaying */}
      <div className={styles.mesh}>
        <motion.div
          animate={isPlaying ? {
            scale: [1, 1.15, 0.95, 1.05, 1],
            rotate: [0, 90, 180, 270, 360],
          } : { scale: 1, rotate: 0 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className={styles.blobOne}
        />
        <motion.div
          animate={isPlaying ? {
            scale: [1, 0.9, 1.1, 0.95, 1],
            rotate: [360, 270, 180, 90, 0],
          } : { scale: 1, rotate: 0 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className={styles.blobTwo}
        />
      </div>

      {/* Quote Icon watermark */}
      <div className={styles.watermark}>
        <Quote className={styles.watermarkIcon} />
      </div>

      <div className={styles.content}>

        {/* Active speaker with beautiful slide-down animation on change */}
        <div className={styles.speakerRow}>
          <AnimatePresence mode="wait">
            <motion.div
              key={segment.speaker}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className={styles.speakerBadge}
            >
              <Badge className={`${styles.speakerPill} ${speakerColors[segment.speaker] || speakerStyles.fallback}`}>
                🎙️ {segment.speaker}
              </Badge>
              <span className={styles.timePill}>
                ⏱️ {formatTime(segment.startTime)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Large Cinematic Subtitle view with slide-up fade segment transitions */}
        <div className={styles.wordsWrap} ref={currentSegmentRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={displayIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
              className={styles.wordsInner}
            >
              {wordTimings.length > 0 ? (
                <p className={styles.subtitle}>
                  {wordTimings.map((wordTiming, wordIdx) => {
                    const isCurrentWord = currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime;
                    const isWordPast = currentTime > wordTiming.endTime;

                    return (
                      <span
                        key={wordIdx}
                        onClick={() => handleWordClick(wordTiming.startTime)}
                        className={`${styles.word} ${
                          isCurrentWord
                            ? styles.wordCurrent
                            : isWordPast
                            ? styles.wordPast
                            : styles.wordFuture
                        }`}
                        title="Click to seek here"
                      >
                        {wordTiming.word}
                        {isCurrentWord && (
                          <motion.span
                            layoutId="activeWordGlow"
                            className={styles.wordGlow}
                            transition={{ duration: 0.15 }}
                          />
                        )}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <p className={styles.fallbackText}>
                  {segment.text}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Small subtitle context indicator */}
        <div className={styles.hint}>
          Click any word to seek playback
        </div>

      </div>
    </Card>
  );
}