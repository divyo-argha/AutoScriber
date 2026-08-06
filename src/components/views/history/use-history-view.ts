import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { listJobs, getJob, deleteJob, parseJobResult } from '@/lib/api';
import type { JobRecord } from '@/lib/api';
import { downloadTranscriptClient } from '@/lib/transcript/download';
import type { ClientExportFormat } from '@/lib/transcript/download';

export type { JobRecord };

/**
 * Owns history data loading, job opening, deletion, and quick-export.
 * The view only renders the resulting state.
 */
export function useHistoryView() {
  const router = useRouter();
  const { setTranscriptionResult, setUploadedFile } = useAppStore();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
          router.push('/');
          return;
        }
      }
      alert('This job has no valid transcription results.');
    } catch (err) {
      console.error('Failed to load job:', err);
      alert('Failed to load transcription.');
    }
  }, [setTranscriptionResult, setUploadedFile, router]);

  const deleteJobById = useCallback(async (jobId: string) => {
    if (!confirm('Delete this transcription? This cannot be undone.')) return;
    setDeleting(jobId);
    try {
      await deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Failed to delete job:', err);
    } finally {
      setDeleting(null);
    }
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
    completedJobs,
    otherJobs,
    loadJobs,
    loadJob,
    deleteJobById,
    exportFromHistory,
    toggleExpanded,
  };
}
