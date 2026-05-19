'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileAudio,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  Loader2,
  AlertTriangle,
  History,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionResult, TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime, formatTimeSRT } from '@/lib/format-utils';

interface HistoryJobFull {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  status: string;
  model: string;
  progress: number;
  chunksTotal: number;
  chunksDone: number;
  errorMessage: string | null;
  result: string | null;
  audioPath: string | null;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function HistoryView() {
  const { setCurrentView, setTranscriptionResult, setUploadedFile } = useAppStore();
  const [jobs, setJobs] = useState<HistoryJobFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const loadJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`);
      if (res.ok) {
        const job: HistoryJobFull = await res.json();
        if (job.status === 'completed' && job.result) {
          const result: TranscriptionResult = JSON.parse(job.result);
          if (result.segments && result.segments.length > 0) {
            // Clear uploadedFile since we're loading from history (audio comes from /api/audio)
            setUploadedFile(null);
            // Set the transcription result with the job ID so AudioPlayer can load audio from /api/audio
            setTranscriptionResult(result.segments, result.fullText, job.id);
            setCurrentView('result');
            return;
          }
        }
        alert('This job has no valid transcription results.');
      }
    } catch (err) {
      console.error('Failed to load job:', err);
      alert('Failed to load transcription.');
    }
  }, [setTranscriptionResult, setCurrentView, setUploadedFile]);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Delete this transcription? This cannot be undone.')) return;
    setDeleting(jobId);
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== jobId));
      }
    } catch (err) {
      console.error('Failed to delete job:', err);
    } finally {
      setDeleting(null);
    }
  }, []);

  const exportFromHistory = useCallback((jobId: string, format: 'txt' | 'md' | 'srt') => {
    const job = jobs.find(j => j.id === jobId);
    if (!job?.result) return;

    try {
      const result: TranscriptionResult = JSON.parse(job.result);
      const segments = result.segments;
      let content = '';
      let filename = job.fileName.replace(/\.[^/.]+$/, '');
      let mimeType = 'text/plain';

      switch (format) {
        case 'txt':
          content = segments
            .map(seg => `[${formatTime(seg.startTime)}] ${seg.speaker}: ${seg.text}`)
            .join('\n');
          filename += '.txt';
          break;
        case 'md':
          content = generateMarkdown(segments, filename);
          filename += '.md';
          break;
        case 'srt':
          content = segments
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
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [jobs]);

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const otherJobs = jobs.filter(j => j.status !== 'completed');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600" />
            Transcription History
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {completedJobs.length} completed transcription{completedJobs.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} className="gap-1.5">
          <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'hidden'}`} />
          {!loading && 'Refresh'}
        </Button>
      </motion.div>

      {loading && jobs.length === 0 ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">Loading history...</p>
        </div>
      ) : jobs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 space-y-4"
        >
          <FileAudio className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">No transcriptions yet.</p>
          <p className="text-xs text-muted-foreground">Your completed transcriptions will appear here.</p>
          <Button variant="outline" onClick={() => setCurrentView('upload')} className="gap-1.5">
            <Play className="w-3.5 h-3.5" />
            Start Your First Transcription
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</h3>
              <AnimatePresence>
                {completedJobs.map((job, i) => {
                  const resultData = job.result ? (() => {
                    try {
                      return JSON.parse(job.result);
                    } catch { return null; }
                  })() : null;
                  const segmentsCount = resultData?.segments?.length || 0;
                  const speakersCount = resultData?.segments
                    ? new Set(resultData.segments.map((s: Record<string, unknown>) => s.speaker)).size
                    : 0;

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className="overflow-hidden hover:border-emerald-500/30 transition-colors">
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{job.fileName}</p>
                                <Badge variant="outline" className="text-[10px]">
                                  {job.model}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(job.duration)}
                                </span>
                                <span>{formatFileSize(job.fileSize)}</span>
                                <span>{segmentsCount} segments</span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {speakersCount} speaker{speakersCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(job.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); loadJob(job.id); }}
                                className="gap-1 text-xs"
                              >
                                <Play className="w-3 h-3" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                                disabled={deleting === job.id}
                              >
                                {deleting === job.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded preview */}
                        <AnimatePresence>
                          {expandedJob === job.id && resultData?.segments && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
                                <div className="max-h-[200px] overflow-y-auto">
                                  {resultData.segments.slice(0, 10).map((seg: Record<string, unknown>, idx: number) => (
                                    <div key={idx} className="flex gap-2 py-1 text-xs">
                                      <span className="text-muted-foreground font-mono shrink-0">
                                        {typeof seg.startTime === 'number'
                                          ? `${Math.floor(seg.startTime / 60)}:${Math.floor(seg.startTime % 60).toString().padStart(2, '0')}`
                                          : '0:00'}
                                      </span>
                                      <span className="font-medium shrink-0">{seg.speaker}:</span>
                                      <span className="text-muted-foreground truncate">{seg.text as string}</span>
                                    </div>
                                  ))}
                                  {resultData.segments.length > 10 && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      ...and {resultData.segments.length - 10} more segments. Click "View" to see full transcription.
                                    </p>
                                  )}
                                </div>
                                {/* Quick export from history */}
                                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Download className="w-3 h-3" />
                                    Quick export:
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1"
                                    onClick={(e) => { e.stopPropagation(); exportFromHistory(job.id, 'txt'); }}
                                  >
                                    TXT
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1"
                                    onClick={(e) => { e.stopPropagation(); exportFromHistory(job.id, 'md'); }}
                                  >
                                    MD
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] gap-1"
                                    onClick={(e) => { e.stopPropagation(); exportFromHistory(job.id, 'srt'); }}
                                  >
                                    SRT
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Failed / Other Jobs */}
          {otherJobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Other</h3>
              {otherJobs.map((job) => (
                <Card key={job.id} className="p-4 opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
                      {job.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{job.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                      </div>
                      {job.errorMessage && (
                        <p className="text-xs text-destructive mt-0.5 truncate">{job.errorMessage}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteJob(job.id)}
                      disabled={deleting === job.id}
                    >
                      {deleting === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateMarkdown(segments: TranscriptionSegment[], fileName: string): string {
  const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))];
  let md = `# Transcription - ${fileName}\n\n`;
  md += `> Generated by **autoScriber**\n\n`;
  md += `## Speakers\n\n`;
  for (const speaker of uniqueSpeakers) {
    md += `- **${speaker}**\n`;
  }
  md += `\n---\n\n## Transcript\n\n`;
  for (const seg of segments) {
    md += `**[${formatTime(seg.startTime)}]** **${seg.speaker}:** ${seg.text}\n\n`;
  }
  return md;
}
