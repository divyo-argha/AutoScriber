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
import styles from './history-view.module.css';

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
            setTranscriptionResult(result.segments, result.fullText, job.id, result.skippedChunks);
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
    <div className={styles.root}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={styles.header}
      >
        <div>
          <h2 className={styles.title}>
            <History className={styles.titleIcon} />
            Transcription History
          </h2>
          <p className={styles.subtitle}>
            {completedJobs.length} completed transcription{completedJobs.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} className={styles.btnGap}>
          <Loader2 className={`${styles.iconSm} ${loading ? styles.spinIcon : styles.hidden}`} />
          {!loading && 'Refresh'}
        </Button>
      </motion.div>

      {loading && jobs.length === 0 ? (
        <div className={styles.loadingWrap}>
          <Loader2 className={styles.loadingIcon} />
          <p className={styles.loadingText}>Loading history...</p>
        </div>
      ) : jobs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={styles.emptyWrap}
        >
          <FileAudio className={styles.emptyIcon} />
          <p className={styles.emptyText}>No transcriptions yet.</p>
          <p className={styles.emptyHint}>Your completed transcriptions will appear here.</p>
          <Button variant="outline" onClick={() => setCurrentView('upload')} className={styles.btnGap}>
            <Play className={styles.iconSm} />
            Start Your First Transcription
          </Button>
        </motion.div>
      ) : (
        <div className={styles.jobsGroup}>
          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div className={styles.groupInner}>
              <h3 className={styles.groupTitle}>Completed</h3>
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
                      <Card className={styles.jobCard}>
                        <div
                          className={styles.jobHeader}
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        >
                          <div className={styles.jobRow}>
                            <div className={styles.jobIconWrap}>
                              <CheckCircle2 className={styles.jobIcon} />
                            </div>
                            <div className={styles.jobBody}>
                              <div className={styles.jobTitleRow}>
                                <p className={styles.jobName}>{job.fileName}</p>
                                <Badge variant="outline" className={styles.jobModelBadge}>
                                  {job.model}
                                </Badge>
                              </div>
                              <div className={styles.jobMeta}>
                                <span className={styles.metaItem}>
                                  <Clock className={styles.iconXs} />
                                  {formatDuration(job.duration)}
                                </span>
                                <span>{formatFileSize(job.fileSize)}</span>
                                <span>{segmentsCount} segments</span>
                                <span className={styles.metaItem}>
                                  <User className={styles.iconXs} />
                                  {speakersCount} speaker{speakersCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className={styles.jobDate}>
                                {formatDate(job.createdAt)}
                              </p>
                            </div>
                            <div className={styles.jobActions}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); loadJob(job.id); }}
                                className={styles.viewBtn}
                              >
                                <Play className={styles.iconXs} />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={styles.iconBtnDanger}
                                onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                                disabled={deleting === job.id}
                              >
                                {deleting === job.id ? (
                                  <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} />
                                ) : (
                                  <Trash2 className={styles.iconSm} />
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
                              className={styles.previewWrap}
                            >
                              <div className={styles.previewInner}>
                                <div className={styles.previewList}>
                                  {resultData.segments.slice(0, 10).map((seg: Record<string, unknown>, idx: number) => (
                                    <div key={idx} className={styles.previewRow}>
                                      <span className={styles.previewTime}>
                                        {typeof seg.startTime === 'number'
                                          ? `${Math.floor(seg.startTime / 60)}:${Math.floor(seg.startTime % 60).toString().padStart(2, '0')}`
                                          : '0:00'}
                                      </span>
                                      <span className={styles.previewSpeaker}>{String(seg.speaker)}:</span>
                                      <span className={styles.previewText}>{seg.text as string}</span>
                                    </div>
                                  ))}
                                  {resultData.segments.length > 10 && (
                                    <p className={styles.previewMore}>
                                      ...and {resultData.segments.length - 10} more segments. Click "View" to see full transcription.
                                    </p>
                                  )}
                                </div>
                                {/* Quick export from history */}
                                <div className={styles.exportRow}>
                                  <span className={styles.exportLabel}>
                                    <Download className={styles.iconXs} />
                                    Quick export:
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={styles.exportBtn}
                                    onClick={(e) => { e.stopPropagation(); exportFromHistory(job.id, 'txt'); }}
                                  >
                                    TXT
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={styles.exportBtn}
                                    onClick={(e) => { e.stopPropagation(); exportFromHistory(job.id, 'md'); }}
                                  >
                                    MD
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={styles.exportBtn}
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
            <div className={styles.groupInner}>
              <h3 className={styles.groupTitle}>Other</h3>
              {otherJobs.map((job) => (
                <Card key={job.id} className={styles.fadedCard}>
                  <div className={styles.otherRow}>
                    <div className={`${styles.jobIconWrap} ${styles.jobIconWrapMuted}`}>
                      {job.status === 'failed' ? (
                        <XCircle className={`${styles.jobIcon} ${styles.jobIconDestructive}`} />
                      ) : (
                        <AlertTriangle className={`${styles.jobIcon} ${styles.jobIconAmber}`} />
                      )}
                    </div>
                    <div className={styles.jobBody}>
                      <p className={styles.jobName}>{job.fileName}</p>
                      <div className={styles.otherMeta}>
                        <Badge variant="outline" className={styles.otherStatus}>{job.status}</Badge>
                        <span className={styles.otherDate}>{formatDate(job.createdAt)}</span>
                      </div>
                      {job.errorMessage && (
                        <p className={styles.otherError}>{job.errorMessage}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${styles.iconBtnDanger} ${styles.shrink}`}
                      onClick={() => deleteJob(job.id)}
                      disabled={deleting === job.id}
                    >
                      {deleting === job.id ? <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} /> : <Trash2 className={styles.iconSm} />}
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
