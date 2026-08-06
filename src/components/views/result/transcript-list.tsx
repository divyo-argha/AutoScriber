import { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { TranscriptRowItem } from './transcript-row-item';
import styles from './transcription-viewer.module.css';

const stagger = {
  animate: { transition: { staggerChildren: 0.03 } },
};

interface TranscriptListProps {
  segments: TranscriptionSegment[];
  speakerColors: Record<string, string>;
  onSegmentClick: (time: number) => void;
}

export function TranscriptList({ segments, speakerColors, onSegmentClick }: TranscriptListProps) {
  const activeSegmentIndex = useAppStore(s => s.activeSegmentIndex);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the active segment as playback progresses.
  useEffect(() => {
    if (activeSegmentRef.current && listContainerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  return (
    <Card className={styles.listCard}>
      <div ref={listContainerRef} className={styles.listContainer}>
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className={styles.listInner}
        >
          {segments.map((segment, idx) => (
            <TranscriptRowItem
              key={idx}
              segment={segment}
              idx={idx}
              speakerColor={speakerColors[segment.speaker] || ''}
              onClick={onSegmentClick}
              activeSegmentRef={activeSegmentRef}
            />
          ))}
        </motion.div>
      </div>
    </Card>
  );
}
