import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { listJobs, getJob, deleteJob, parseJobResult, parseChunkResults } from '@/lib/api';
import type { JobRecord } from '@/lib/api';
import { downloadTranscriptClient } from '@/lib/transcript/download';
import type { ClientExportFormat } from '@/lib/transcript/download';
import { useToast } from '@/hooks/use-toast';
import { cleanAndMergeSegments } from '@/lib/transcriber/merger';
import { formatTime } from '@/lib/format-utils';

export type { JobRecord };

/**
 * Owns history data loading, job opening, deletion, and quick-export.
 * The view only renders the resulting state.
 */
export function useHistoryView() {
  const router = useRouter();
  const { toast } = useToast();
  const { setTranscriptionResult, setUploadedFile } = useAppStore();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<JobRecord | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listJobs();
      setJobs(data.jobs || []);
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
      const job = await getJob(jobId);
      if (job.status === 'completed' && job.result) {
        const result = parseJobResult(job);
        if (result && result.segments.length > 0) {
          // Clear uploadedFile since we're loading from history (audio comes from /api/audio)
          setUploadedFile(null);
          // Set the transcription result with the job ID so AudioPlayer can load audio from /api/audio
          setTranscriptionResult(result.segments, result.fullText, job.id, result.skippedChunks);
          useAppStore.getState().setCurrentView('result');
          router.push('/app');
          return;
        }
      }
      toast({
        variant: 'destructive',
        title: 'No Results',
        description: 'This job has no valid transcription results.',
      });
    } catch (err) {
      console.error('Failed to load job:', err);
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: 'Failed to load this transcription. Please try again.',
      });
    }
  }, [setTranscriptionResult, setUploadedFile, router, toast]);

  const requestDelete = useCallback((job: JobRecord) => {
    setConfirmDeleteJob(job);
  }, []);

  const confirmDelete = useCallback(async () => {
    const job = confirmDeleteJob;
    if (!job) return;
    setDeleting(job.id);
    setConfirmDeleteJob(null);
    try {
      await deleteJob(job.id);
      setJobs(prev => prev.filter(j => j.id !== job.id));
      toast({
        title: 'Deleted',
        description: `"${job.fileName}" was removed from history.`,
      });
    } catch (err) {
      console.error('Failed to delete job:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Could not delete this transcription. Please try again.',
      });
    } finally {
      setDeleting(null);
    }
  }, [confirmDeleteJob, toast]);

  const cancelDelete = useCallback(() => {
    setConfirmDeleteJob(null);
  }, []);

  const exportFromHistory = useCallback((job: JobRecord, format: ClientExportFormat) => {
    const result = parseJobResult(job);
    if (!result || result.segments.length === 0) return;
    const base = job.fileName.replace(/\.[^/.]+$/, '');
    downloadTranscriptClient(result.segments, format, base);
  }, []);

  const toggleExpanded = useCallback((jobId: string) => {
    setExpandedJob(prev => (prev === jobId ? null : jobId));
  }, []);

  const recoverPartial = useCallback(async (job: JobRecord) => {
    const rawChunks = parseChunkResults(job);
    if (!rawChunks || rawChunks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Partial Data',
        description: 'No chunk data was saved for this job — nothing to recover.',
      });
      return;
    }
    try {
      // Merge all saved chunk segments into a partial result
      const allSegments = (rawChunks as Array<{ segments: Array<{ startTime: number; endTime: number; speaker: string; text: string }> }>)
        .flatMap(c => c.segments || []);
      const merged = cleanAndMergeSegments(allSegments);
      if (merged.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Empty Partial',
          description: 'Chunk data exists but produced no readable segments.',
        });
        return;
      }
      const fullText = merged.map(s => `[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`).join('\n');
      setUploadedFile(null);
      setTranscriptionResult(merged, fullText, job.id, undefined);
      useAppStore.getState().setCurrentView('result');
      router.push('/app');
      toast({
        title: '⚠️ Partial Recovery',
        description: `Recovered ${merged.length} segments from the ${job.status} transcription. Some audio may be missing.`,
      });
    } catch (err) {
      console.error('Partial recovery failed:', err);
      toast({
        variant: 'destructive',
        title: 'Recovery Failed',
        description: 'Could not recover partial transcription data.',
      });
    }
  }, [setTranscriptionResult, setUploadedFile, router, toast]);

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed' || j.status === 'cancelled');
  const otherJobs = jobs.filter(j => !['completed', 'failed', 'cancelled'].includes(j.status));

  return {
    jobs,
    loading,
    expandedJob,
    deleting,
    confirmDeleteJob,
    completedJobs,
    failedJobs,
    otherJobs,
    loadJobs,
    loadJob,
    requestDelete,
    confirmDelete,
    cancelDelete,
    exportFromHistory,
    recoverPartial,
    toggleExpanded,
  };
}
