'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime, formatTimeSRT } from '@/lib/format-utils';
import { AudioPlayer } from './audio-player';

type ExportFormat = 'txt' | 'md' | 'srt' | 'docx' | 'pdf';
type ViewMode = 'player' | 'list';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export function TranscriptionViewer() {
  const { transcriptionSegments, transcriptionText, reset, setCurrentView, jobId } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('player');

  const speakerColors = useMemo(() => {
    const colors = [
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
      'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
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

  if (transcriptionSegments.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">No transcription results available.</p>
        <p className="text-xs text-muted-foreground">The transcription may have produced empty results. Try uploading a different audio file.</p>
        <Button variant="outline" onClick={handleNewTranscription} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Start New Transcription
        </Button>
      </div>
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
      className="max-w-4xl mx-auto space-y-4"
    >
      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center gap-3"
      >
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" />
          {transcriptionSegments.length} segments
        </Badge>
        <Badge variant="outline" className="gap-1">
          <User className="w-3 h-3" />
          {uniqueSpeakers.length} speaker{uniqueSpeakers.length !== 1 ? 's' : ''}
        </Badge>
        {jobId && (
          <Badge variant="outline" className="gap-1 text-xs">
            Saved in history
          </Badge>
        )}

        <div className="flex-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === 'player' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('player')}
            className="gap-1.5 h-7 text-xs rounded-md"
          >
            <Headphones className="w-3 h-3" />
            Player
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-1.5 h-7 text-xs rounded-md"
          >
            <List className="w-3 h-3" />
            List
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleNewTranscription} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          New
        </Button>
      </motion.div>

      {/* Speaker Legend */}
      <AnimatePresence>
        {uniqueSpeakers.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-wrap gap-2"
          >
            {uniqueSpeakers.map((speaker, i) => (
              <motion.div
                key={speaker}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Badge className={`${speakerColors[speaker]} border-0`}>
                  {speaker}
                </Badge>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {viewMode === 'player' ? (
          <motion.div
            key="player"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <AudioPlayer segments={transcriptionSegments} speakerColors={speakerColors} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto scroll-smooth">
                <motion.div
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="p-4 sm:p-6 space-y-0.5"
                >
                  {transcriptionSegments.map((segment, idx) => (
                    <motion.div
                      key={idx}
                      variants={fadeUp}
                      transition={{ duration: 0.2 }}
                      className="group flex gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="shrink-0 w-24 pt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatTime(segment.startTime)}
                        </span>
                      </div>
                      <div className="shrink-0 w-24">
                        <Badge
                          className={`${speakerColors[segment.speaker] || 'bg-muted text-muted-foreground'} border-0 text-[10px] px-1.5 py-0 truncate max-w-full`}
                        >
                          {segment.speaker}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{segment.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Download as</span>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-6" />
            <div className="flex flex-wrap gap-2">
              {exportFormats.map(({ format, label, icon }) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(format)}
                  disabled={exportingFormat !== null}
                  className="gap-1.5 transition-all duration-200 hover:scale-105"
                >
                  {exportingFormat === format ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    icon
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
