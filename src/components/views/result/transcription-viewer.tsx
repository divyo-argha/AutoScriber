'use client';

import { useState, useMemo, useRef, useEffect, memo } from 'react';

// Memoized individual segment row for 60fps audio playback
const TranscriptRowItem = memo(function TranscriptRowItem({
  segment,
  idx,
  speakerColor,
  onClick,
  activeSegmentRef,
}: {
  segment: TranscriptionSegment;
  idx: number;
  speakerColor: string;
  onClick: (time: number) => void;
  activeSegmentRef?: React.Ref<HTMLDivElement>;
}) {
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
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  FileText,
  FileType2,
  FileDown,
  Clock,
  User,
  Copy,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Headphones,
  List,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime, formatTimeSRT } from '@/lib/format-utils';
import { AudioPlayer } from './audio-player';
import { FocusPlayer } from './focus-player';
import { calculateWordTimings } from '@/lib/word-timing';
import styles from './transcription-viewer.module.css';
import speakerStyles from './speaker-colors.module.css';

type ExportFormat = 'txt' | 'md' | 'srt' | 'docx' | 'pdf';
type ViewMode = 'player' | 'list';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.03 } },
};

export function TranscriptionViewer() {
  const { transcriptionSegments, transcriptionText, reset, setCurrentView, jobId, currentTime, activeSegmentIndex, transcriptionSkippedChunks, chunkDuration, audioDuration } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('player');
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active segment in full list mode
  useEffect(() => {
    if (activeSegmentRef.current && listContainerRef.current && viewMode === 'list') {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex, viewMode]);

  const speakerColors = useMemo(() => {
    const colors = [
      speakerStyles.sp0,
      speakerStyles.sp1,
      speakerStyles.sp2,
      speakerStyles.sp3,
      speakerStyles.sp4,
      speakerStyles.sp5,
      speakerStyles.sp6,
      speakerStyles.sp7,
    ];
    const map: Record<string, string> = {};
    let colorIdx = 0;
    for (const seg of transcriptionSegments) {
      if (!map[seg.speaker]) {
        map[seg.speaker] = colors[colorIdx % colors.length];
        colorIdx++;
      }
    }
    return map;
  }, [transcriptionSegments]);

  const uniqueSpeakers = useMemo(() => {
    const speakers = new Set(transcriptionSegments.map(s => s.speaker));
    return Array.from(speakers);
  }, [transcriptionSegments]);

  // Time ranges covered by skipped (failed) chunks, so the user knows exactly
  // which parts of the recording may be missing from the transcript.
  const skippedRanges = useMemo(() => {
    const dur = Math.max(chunkDuration || 300, 1);
    return transcriptionSkippedChunks
      .sort((a, b) => a - b)
      .map(i => [i * dur, Math.min((i + 1) * dur, audioDuration > 0 ? audioDuration : (i + 1) * dur)] as [number, number]);
  }, [transcriptionSkippedChunks, chunkDuration, audioDuration]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const exportClientFile = (format: 'txt' | 'md' | 'srt') => {
    let content = '';
    let filename = 'transcription';
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = transcriptionSegments
          .map(seg => `[${formatTime(seg.startTime)}] ${seg.speaker}: ${seg.text}`)
          .join('\n');
        filename += '.txt';
        break;
      case 'md':
        content = generateMarkdown(transcriptionSegments);
        filename += '.md';
        break;
      case 'srt':
        content = transcriptionSegments
          .map((seg, idx) => {
            const index = idx + 1;
            const start = formatTimeSRT(seg.startTime);
            const end = formatTimeSRT(seg.endTime);
            return `${index}\n${start} --> ${end}\n${seg.speaker}: ${seg.text}\n`;
          })
          .join('\n');
        filename += '.srt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportServerFile = async (format: 'docx' | 'pdf') => {
    setExportingFormat(format);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          segments: transcriptionSegments,
          fileName: 'transcription',
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcription.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExport = (format: ExportFormat) => {
    if (format === 'docx' || format === 'pdf') {
      exportServerFile(format);
    } else {
      exportClientFile(format);
    }
  };

  const handleNewTranscription = () => {
    reset();
    setCurrentView('upload');
  };

  const handleSegmentClick = (startTime: number) => {
    if (typeof (window as any).__autoScribeSeek === 'function') {
      (window as any).__autoScribeSeek(startTime);
    }
  };

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
          </p>
        </div>
        <Button variant="outline" onClick={handleNewTranscription} className={styles.btnGap}>
          <RotateCcw className={styles.iconSm} />
          Start New Transcription
        </Button>
      </motion.div>
    );
  }

  const exportFormats: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { format: 'txt', label: 'TXT', icon: <FileText className={styles.iconSm} /> },
    { format: 'md', label: 'Markdown', icon: <FileType2 className={styles.iconSm} /> },
    { format: 'srt', label: 'SRT', icon: <FileText className={styles.iconSm} /> },
    { format: 'docx', label: 'DOCX', icon: <FileDown className={styles.iconSm} /> },
    { format: 'pdf', label: 'PDF', icon: <FileDown className={styles.iconSm} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={styles.root}
    >
      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={styles.statsBar}
      >
        <div className={styles.statGroup}>
          <Badge variant="outline" className={styles.statBadge}>
            <Clock className={styles.statIcon} />
            {transcriptionSegments.length} segments
          </Badge>
          <Badge variant="outline" className={styles.statBadge}>
            <User className={styles.statIcon} />
            {uniqueSpeakers.length} speaker{uniqueSpeakers.length !== 1 ? 's' : ''}
          </Badge>
          {jobId && (
            <Badge variant="outline" className={styles.savedBadge}>
              Saved in history
            </Badge>
          )}
        </div>

        <div className={styles.spacer} />

        {/* View Mode Tab Toggles */}
        <div className={styles.modeSwitch}>
          <Button
            variant={viewMode === 'player' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('player')}
            className={`${styles.modeBtn} ${viewMode === 'player' ? styles.modeBtnActive : styles.modeBtnInactive}`}
          >
            <Headphones className={styles.iconSm} />
            Focus view
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={`${styles.modeBtn} ${viewMode === 'list' ? styles.modeBtnActive : styles.modeBtnInactive}`}
          >
            <List className={styles.iconSm} />
            Full Transcript
          </Button>
        </div>

        <div className={styles.actionsGroup}>
          <Button variant="outline" size="sm" onClick={copyToClipboard} className={styles.actionBtn}>
            {copied ? <CheckCircle2 className={styles.copyIcon} /> : <Copy className={styles.iconSm} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewTranscription} className={styles.actionBtn}>
            <RotateCcw className={styles.iconSm} />
            New
          </Button>
        </div>
      </motion.div>

      {/* Missing-content warning (failed chunks after all retries) */}
      <AnimatePresence>
        {transcriptionSkippedChunks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={styles.warnBox}
          >
            <AlertTriangle className={styles.warnIcon} />
            <div className={styles.warnInner}>
              <p className={styles.warnTitle}>
                {transcriptionSkippedChunks.length} chunk{transcriptionSkippedChunks.length !== 1 ? 's' : ''} could not be transcribed
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

      {/* Speaker Legend */}
      <AnimatePresence>
        {uniqueSpeakers.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={styles.legend}
          >
            {uniqueSpeakers.map((speaker, i) => (
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

      {/* UNIFIED Audio Controls - Always docked at top for uninterrupted control! */}
      <AudioPlayer />

      {/* Swappable Content Panels with elegant animations */}
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
              <Card className={styles.listCard}>
                <div
                  ref={listContainerRef}
                  className={styles.listContainer}
                >
                  <motion.div
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    className={styles.listInner}
                  >
                    {transcriptionSegments.map((segment, idx) => (
                      <TranscriptRowItem
                        key={idx}
                        segment={segment}
                        idx={idx}
                        speakerColor={speakerColors[segment.speaker] || ''}
                        onClick={handleSegmentClick}
                        activeSegmentRef={activeSegmentRef}
                      />
                    ))}
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Export Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className={styles.exportCard}>
          <div className={styles.exportInner}>
            <div className={styles.exportHeader}>
              <div className={styles.exportIconWrap}>
                <Sparkles className={styles.exportIcon} />
              </div>
              <div>
                <h3 className={styles.exportTitle}>Export & Transcribe History</h3>
                <p className={styles.exportSub}>Download formatted transcripts or sync options</p>
              </div>
            </div>
            <Separator className={styles.exportDivider} />
            <div className={styles.exportGrid}>
              {exportFormats.map(({ format, label, icon }) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(format)}
                  disabled={exportingFormat !== null}
                  className={styles.exportBtn}
                >
                  {exportingFormat === format ? (
                    <Loader2 className={styles.exportSpinner} />
                  ) : (
                    <span className={styles.exportBtnIcon}>{icon}</span>
                  )}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function generateMarkdown(segments: TranscriptionSegment[]): string {
  const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))];

  let md = `# Transcription\n\n`;
  md += `> Generated by **autoScriber** on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n`;
  md += `## Speakers\n\n`;
  for (const speaker of uniqueSpeakers) {
    md += `- **${speaker}**\n`;
  }
  md += `\n---\n\n`;
  md += `## Transcript\n\n`;
  for (const seg of segments) {
    md += `**[${formatTime(seg.startTime)}]** **${seg.speaker}:** ${seg.text}\n\n`;
  }

  return md;
}
