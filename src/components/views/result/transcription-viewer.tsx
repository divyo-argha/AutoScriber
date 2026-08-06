'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { AudioPlayer } from '@/components/audio';
import { FocusPlayer } from './focus-player';
import { useTranscriptionViewer } from './use-transcription-viewer';
import { StatsBar } from './viewer-stats-bar';
import { SkippedChunksWarning, SpeakerLegend } from './viewer-warnings';
import { ExportCard } from './viewer-export-card';
import { TranscriptList } from './transcript-list';
import styles from './transcription-viewer.module.css';

export function TranscriptionViewer() {
  const { transcriptionSegments, jobId, transcriptionSkippedChunks } = useAppStore();
  const {
    copied,
    exportingFormat,
    viewMode,
    setViewMode,
    speakerColors,
    uniqueSpeakers,
    skippedRanges,
    copyToClipboard,
    handleSegmentClick,
    handleExport,
  } = useTranscriptionViewer();

  if (transcriptionSegments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.emptyWrap}
      >
        <div className={styles.emptyIconWrap}>
          <FileText className={styles.emptyIcon} />
        </div>
        <div className={styles.emptyInner}>
          <p className={styles.emptyTitle}>No transcription results available</p>
          <p className={styles.emptySub}>
            The transcription may have produced empty results. Try uploading a different audio file or check your audio quality.
            Use the New button in the top bar to start another transcription.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={styles.root}
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <StatsBar
          segmentCount={transcriptionSegments.length}
          speakerCount={uniqueSpeakers.length}
          jobId={jobId}
          viewMode={viewMode}
          copied={copied}
          onCopy={copyToClipboard}
          onViewModeChange={setViewMode}
        />
      </motion.div>

      <SkippedChunksWarning
        skippedCount={transcriptionSkippedChunks.length}
        skippedRanges={skippedRanges}
      />

      <SpeakerLegend speakers={uniqueSpeakers} speakerColors={speakerColors} />

      <AudioPlayer />

      <div className={styles.panelWrap}>
        <AnimatePresence mode="wait">
          {viewMode === 'player' ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className={styles.panelFull}
            >
              <FocusPlayer segments={transcriptionSegments} speakerColors={speakerColors} />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className={styles.panelFull}
            >
              <TranscriptList
                segments={transcriptionSegments}
                speakerColors={speakerColors}
                onSegmentClick={handleSegmentClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <ExportCard exportingFormat={exportingFormat} onExport={handleExport} />
      </motion.div>
    </motion.div>
  );
}
