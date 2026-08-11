'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { getJob, parseJobResult, parseChunkResults } from '@/lib/api';
import type { ChunkResult } from '@/lib/transcriber/types';

const ACTIVE_JOB_KEY = 'autoscribe_active_job_id';
const POLL_INTERVAL_MS = 2500;

/**
 * Global job poller mounted in the root layout. Keeps the store's processing
 * state fresh no matter which page the user is on, so an in-flight
 * transcription continues to report progress while browsing History, Batch,
 * or Settings. Restores an active job on first load too.
 */
export function JobPoller() {
  const router = useRouter();
  const jobId = useAppStore(s => s.jobId);
  const setSettings = useAppStore(s => s.setSettings);
  const setHistoryJobs = useAppStore(s => s.setHistoryJobs);
  const setProcessingState = useAppStore(s => s.setProcessingState);
  const setTranscriptionResult = useAppStore(s => s.setTranscriptionResult);
  const setDisabledModel = useAppStore(s => s.setDisabledModel);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const job = await getJob(id);
      if (!job || !job.status) return;

      const liveResults: ChunkResult[] = parseChunkResults(job) as ChunkResult[];

      // If the job is already completed with a result, transition immediately
      // without cycling through the 'Deduplicating...' intermediate status.
      if (job.status === 'completed' && job.result) {
        stopPolling();
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        const result = parseJobResult(job);
        if (result && result.segments.length > 0) {
          setProcessingState({
            paused: false,
            isProcessing: false,
            processingProgress: 100,
            processingStatus: 'Transcription complete!',
            liveChunkResults: liveResults,
          });
          setTranscriptionResult(result.segments, result.fullText, job.id, result.skippedChunks);
          useAppStore.getState().setCurrentView('result');
          router.push('/app');
          return;
        }
        // result JSON exists but is empty/corrupt — treat as failed
        setProcessingState({
          paused: false,
          isProcessing: false,
          processingProgress: job.progress ?? 100,
          processingStatus: 'Failed: transcription result was empty or unreadable.',
          liveChunkResults: liveResults,
        });
        return;
      }

      // Sync selected model in store
      if (job.model && useAppStore.getState().selectedModel !== job.model) {
        useAppStore.getState().setSelectedModel(job.model);
      }

      setProcessingState({
        paused: job.controlStatus === 'paused',
        processingProgress: job.progress ?? 0,
        chunksTotal: job.chunksTotal ?? 0,
        chunksDone: job.chunksDone ?? 0,
        liveChunkResults: liveResults,
        processingStatus: job.status === 'processing'
          ? job.controlStatus === 'paused'
            ? job.errorMessage || 'Paused — press Resume to continue'
            : job.chunksDone >= job.chunksTotal && job.chunksTotal > 0
              ? 'Deduplicating overlaps & finalizing merged transcript...'
              : `Transcribing segment ${Math.min(job.chunksDone + 1, job.chunksTotal)}/${job.chunksTotal}...`
          : job.status === 'chunking'
            ? 'Splitting audio into chunks with FFmpeg...'
            : job.status === 'failed'
              ? job.errorMessage || 'Transcription failed'
              : job.status,
      });

      if (job.status === 'failed') {
        stopPolling();
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        if (job.errorMessage?.includes('429') || job.errorMessage?.includes('quota') || job.errorMessage?.includes('resource_exhausted') || job.errorMessage?.includes('limit: 0')) {
          setDisabledModel(job.model, 'Rate Limit (429) / Quota Exhausted');
        }
        setProcessingState({
          paused: false,
          isProcessing: false,
          processingStatus: `Failed: ${job.errorMessage || 'Transcription failed'}`,
        });
      }

      if (job.status === 'cancelled') {
        stopPolling();
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        setProcessingState({
          paused: false,
          isProcessing: false,
          processingProgress: job.progress ?? 0,
          processingStatus: 'Cancelled by user',
        });
      }
    } catch (err) {
      console.error('Job polling error:', err);
    }
  };

  // Restore settings, history, and any in-flight job on first load.
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSettings({
              chunkDuration: typeof data.chunkDuration === 'number' ? data.chunkDuration : 300,
              overlapDuration: typeof data.overlapDuration === 'number' ? data.overlapDuration : 30,
              geminiApiKey: data.geminiApiKey ?? '',
              userGeminiApiKey: data.userGeminiApiKey || '',
              hasVertexKey: !!data.gcpCredentialsStatus?.exists,
            });
          }
        }
      } catch {}
    };

    const loadHistoryAndCheckActiveJob = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && Array.isArray(data.jobs)) {
            setHistoryJobs(data.jobs.map((job: Record<string, unknown>) => ({
              id: job.id as string,
              fileName: job.fileName as string,
              fileSize: job.fileSize as number,
              duration: job.duration as number | null,
              status: job.status as string,
              model: job.model as string,
              createdAt: job.createdAt as string,
              segmentsCount: job.result ? JSON.parse(job.result as string).segments?.length || 0 : 0,
              speakersCount: job.result ? new Set(JSON.parse(job.result as string).segments?.map((s: Record<string, unknown>) => s.speaker)).size : 0,
            })));

            const storedJobId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_JOB_KEY) : null;
            const activeJob = data.jobs.find((j: Record<string, unknown>) =>
              j.id === storedJobId || ['pending', 'uploading', 'chunking', 'processing', 'paused'].includes(j.status as string)
            );

            if (activeJob && ['pending', 'uploading', 'chunking', 'processing', 'paused'].includes(activeJob.status as string)) {
              setProcessingState({
                paused: (activeJob.controlStatus as string) === 'paused',
                isProcessing: true,
                jobId: activeJob.id as string,
                processingProgress: (activeJob.progress as number) ?? 0,
                chunksTotal: (activeJob.chunksTotal as number) ?? 0,
                chunksDone: (activeJob.chunksDone as number) ?? 0,
                processingStatus: (activeJob.controlStatus as string) === 'paused' ? 'Paused — press Resume to continue' : 'Transcribing audio...',
              });
            }
          }
        }
      } catch {}
    };

    loadSettings();
    loadHistoryAndCheckActiveJob();
  }, []);

  // Poll whenever a job id appears, and keep polling until it clears.
  useEffect(() => {
    if (!jobId) return;

    pollJobStatus(jobId);
    pollingRef.current = setInterval(() => pollJobStatus(jobId), POLL_INTERVAL_MS);

    return stopPolling;
  }, [jobId]);

  return null;
}
