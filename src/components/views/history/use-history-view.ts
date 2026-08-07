import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { listJobs, getJob, deleteJob, parseJobResult } from '@/lib/api';
import type { JobRecord } from '@/lib/api';
import { downloadTranscriptClient } from '@/lib/transcript/download';
import type { ClientExportFormat } from '@/lib/transcript/download';
import { useToast } from '@/hooks/use-toast';

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

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const otherJobs = jobs.filter(j => j.status !== 'completed');

  return {
    jobs,
    loading,
    expandedJob,
    deleting,
    confirmDeleteJob,
    completedJobs,
    otherJobs,
    loadJobs,
    loadJob,
    requestDelete,
    confirmDelete,
    cancelDelete,
    exportFromHistory,
    toggleExpanded,
  };
}
