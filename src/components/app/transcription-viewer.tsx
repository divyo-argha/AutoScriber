'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime, formatTimeSRT } from '@/lib/format-utils';
import { AudioPlayer } from './audio-player';
import { FocusPlayer } from './focus-player';
import { calculateWordTimings } from '@/lib/word-timing';

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
  const { transcriptionSegments, transcriptionText, reset, setCurrentView, jobId, currentTime, activeSegmentIndex } = useAppStore();
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
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20',
      'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-500/20',
      'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-500/20',
      'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20',
      'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-500/20',
      'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-500/20',
      'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-500/20',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-500/20',
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
        className="text-center py-12 space-y-4"
      >
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-muted">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-medium">No transcription results available</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The transcription may have produced empty results. Try uploading a different audio file or check your audio quality.
          </p>
        </div>
        <Button variant="outline" onClick={handleNewTranscription} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Start New Transcription
        </Button>
      </motion.div>
    );
  }

  const exportFormats: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { format: 'txt', label: 'TXT', icon: <FileText className="w-3.5 h-3.5" /> },
    { format: 'md', label: 'Markdown', icon: <FileType2 className="w-3.5 h-3.5" /> },
    { format: 'srt', label: 'SRT', icon: <FileText className="w-3.5 h-3.5" /> },
    { format: 'docx', label: 'DOCX', icon: <FileDown className="w-3.5 h-3.5" /> },
    { format: 'pdf', label: 'PDF', icon: <FileDown className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto space-y-5"
    >
      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center gap-3 bg-secondary/20 p-2 rounded-2xl border border-border/40 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 px-1.5">
          <Badge variant="outline" className="gap-1 bg-background/50 border-border/40">
            <Clock className="w-3 h-3 text-emerald-500" />
            {transcriptionSegments.length} segments
          </Badge>
          <Badge variant="outline" className="gap-1 bg-background/50 border-border/40">
            <User className="w-3 h-3 text-emerald-500" />
            {uniqueSpeakers.length} speaker{uniqueSpeakers.length !== 1 ? 's' : ''}
          </Badge>
          {jobId && (
            <Badge variant="outline" className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Saved in history
            </Badge>
          )}
        </div>

        <div className="flex-1" />

        {/* View Mode Tab Toggles */}
        <div className="flex items-center bg-muted/65 p-1 rounded-full border border-border/40">
          <Button
            variant={viewMode === 'player' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('player')}
            className={`gap-1.5 h-8 text-xs rounded-full px-3.5 transition-all duration-200 ${
              viewMode === 'player' ? 'bg-background shadow-sm font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            Focus view
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={`gap-1.5 h-8 text-xs rounded-full px-3.5 transition-all duration-200 ${
              viewMode === 'list' ? 'bg-background shadow-sm font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Full Transcript
          </Button>
        </div>

        <div className="flex items-center gap-1.5 pr-1">
          <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-8 rounded-full border-border/40 gap-1.5 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewTranscription} className="h-8 rounded-full border-border/40 gap-1.5 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20">
            <RotateCcw className="w-3.5 h-3.5" />
            New
          </Button>
        </div>
      </motion.div>

      {/* Speaker Legend */}
      <AnimatePresence>
        {uniqueSpeakers.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 px-1.5"
          >
            {uniqueSpeakers.map((speaker, i) => (
              <motion.div
                key={speaker}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Badge className={`${speakerColors[speaker]} border-0 text-[10px] px-2.5 py-0.5 rounded-full shadow-sm shadow-emerald-500/5`}>
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
      <div className="relative">
        <AnimatePresence mode="wait">
          {viewMode === 'player' ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full"
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
              className="w-full"
            >
              <Card className="overflow-hidden border border-emerald-500/10 shadow-lg shadow-emerald-500/5 bg-card/65 backdrop-blur-md rounded-2xl">
                <div 
                  ref={listContainerRef} 
                  className="max-h-[60vh] overflow-y-auto scroll-smooth divide-y divide-border/20"
                >
                  <motion.div
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    className="p-3 sm:p-5 space-y-1.5"
                  >
                    {transcriptionSegments.map((segment, idx) => {
                      const isActive = idx === activeSegmentIndex;
                      const isPast = currentTime > segment.endTime;
                      
                      // Calculate word timings only for the active segment for high performance
                      const segmentWordTimings = isActive 
                        ? calculateWordTimings(segment.text, segment.startTime, segment.endTime)
                        : [];

                      return (
                        <motion.div
                          ref={isActive ? activeSegmentRef : null}
                          key={idx}
                          variants={fadeUp}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleSegmentClick(segment.startTime)}
                          className={`group flex items-start gap-4 py-3 px-3.5 rounded-xl transition-all duration-350 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 shadow-sm rounded-r-xl'
                              : isPast
                              ? 'opacity-60 hover:opacity-100 hover:bg-muted/40'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          {/* 1. Time Column - Stable 56px */}
                          <div className="shrink-0 w-14 pt-1 select-none">
                            <span className={`text-xs font-mono font-medium leading-none ${
                              isActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground/60'
                            }`}>
                              {formatTime(segment.startTime).split('.')[0]}
                            </span>
                          </div>

                          {/* 2. Speaker Column - Stable 84px */}
                          <div className="shrink-0 w-20 sm:w-24 pt-0.5 select-none">
                            <Badge
                              className={`${speakerColors[segment.speaker] || 'bg-muted'} border-0 text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full`}
                            >
                              {segment.speaker}
                            </Badge>
                          </div>

                          {/* 3. Text Content Column - Flexible */}
                          <div className="flex-1 min-w-0">
                            {isActive && segmentWordTimings.length > 0 ? (
                              <p className="text-[13.5px] sm:text-[14.5px] leading-relaxed text-foreground select-none">
                                {segmentWordTimings.map((wordTiming, wordIdx) => {
                                  const isCurrentWord = currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime;
                                  const isWordPast = currentTime > wordTiming.endTime;
                                  
                                  return (
                                    <span
                                      key={wordIdx}
                                      onClick={(e) => {
                                        e.stopPropagation(); // Avoid double seek from parent container click
                                        handleSegmentClick(wordTiming.startTime);
                                      }}
                                      className={`inline-block mr-1 rounded px-1 transition-all duration-100 cursor-pointer ${
                                        isCurrentWord
                                          ? 'font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-500/20 scale-[1.03]'
                                          : isWordPast
                                          ? 'text-foreground font-semibold opacity-90'
                                          : 'text-muted-foreground/50 font-normal'
                                      }`}
                                    >
                                      {wordTiming.word}
                                    </span>
                                  );
                                })}
                              </p>
                            ) : (
                              <p className={`text-[13.5px] sm:text-[14.5px] leading-relaxed transition-all duration-300 ${
                                isActive ? 'font-semibold text-foreground' : isPast ? 'text-muted-foreground/80' : 'text-foreground/95'
                              }`}>
                                {segment.text}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
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
        <Card className="relative overflow-hidden p-5 bg-gradient-to-br from-card/90 to-card/60 dark:from-zinc-900/90 dark:to-zinc-950/60 border border-emerald-500/10 shadow-lg shadow-emerald-500/5 backdrop-blur-md rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 shadow-inner">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Export & Transcribe History</h3>
                <p className="text-xs text-muted-foreground">Download formatted transcripts or sync options</p>
              </div>
            </div>
            <Separator className="bg-border/30" />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {exportFormats.map(({ format, label, icon }) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(format)}
                  disabled={exportingFormat !== null}
                  className="gap-2 font-medium text-xs py-2 rounded-full border-border/40 bg-background/50 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 hover:border-emerald-500/35 transition-all duration-200 active:scale-95 hover:-translate-y-0.5 shadow-sm"
                >
                  {exportingFormat === format ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  ) : (
                    <span className="text-muted-foreground group-hover:text-emerald-500">{icon}</span>
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
