'use client';

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getJob, controlJob, parseJobResult, parseChunkResults, startTranscriptionWithSignal, ApiError } from '@/lib/api';
import type { JobAction } from '@/lib/api';
import type { ChunkResult, TranscriptionResult } from '@/lib/transcriber/types';

const ACTIVE_JOB_KEY = 'autoscribe_active_job_id';

/**
 * Owns the entire single-file transcription job lifecycle: starting the job,
 * polling its status, and sending pause/resume/cancel control commands.
 * The view component only renders the resulting state.
 */
export function useTranscriptionJob() {
  const {
    uploadedFile,
    uploadedFileName,
    selectedModel,
    chunkDuration,
    overlapDuration,
    isProcessing,
    processingProgress,
    processingStatus,
    chunksTotal,
    chunksDone,
    liveChunkResults,
    jobId,
    setProcessingState,
    setTranscriptionResult,
    setCurrentView,
    availableModels,
    setDisabledModel,
  } = useAppStore();

  const hasStarted = useRef(false);
  const startTimeRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [paused, setPaused] = useState(() => useAppStore.getState().processingStatus.startsWith('Paused'));
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const estimatedTime = useMemo(() => {
    if (!isProcessing || processingProgress <= 0 || processingProgress >= 100) return '';
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed <= 0) return '';
    const rate = processingProgress / elapsed;
    if (!isFinite(rate) || rate <= 0) return '';
    const remaining = (100 - processingProgress) / rate;
    if (remaining > 0 && isFinite(remaining)) {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      return mins > 0 ? `~${mins}m ${secs}s remaining` : `~${secs}s remaining`;
    }
    return '';
  }, [isProcessing, processingProgress]);

  const modelInfo = availableModels.find(m => m.id === selectedModel);

  // Parse the error type from the status message
  const isLocationError = processingStatus.includes('location') && processingStatus.includes('not supported');
  const isAuthError = processingStatus.includes('API key') && (processingStatus.includes('not valid') || processingStatus.includes('invalid'));
  const isCancelled = !isProcessing && processingStatus.startsWith('Cancelled');
  const isFailed = !isProcessing && !isCancelled && (
    processingStatus.startsWith('Failed') || processingStatus.startsWith('Error')
  );

  // Pause, resume, or cancel the running job via the control API
  const sendControl = useCallback(async (action: JobAction) => {
    if (action === 'cancel') {
      setCancelling(true);
      try {
        localStorage.removeItem(ACTIVE_JOB_KEY);
      } catch {}

      // If the upload/startup request is still in flight, abort it right away.
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // No job id yet (still uploading/starting) — nothing to cancel server-side.
      if (!jobId) {
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Cancelled by user',
        });
        setCancelling(false);
        return;
      }
    }
    if (!jobId) return;
    try {
      await controlJob(jobId, action);
      if (action === 'cancel') {
        stopPolling();
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Cancelled by user',
        });
      } else if (action === 'pause') {
        setPaused(true);
        setProcessingState({
          processingStatus: 'Paused — press Resume to continue',
        });
      } else if (action === 'resume') {
        setPaused(false);
        setProcessingState({
          processingStatus: 'Resuming transcription...',
        });
      }
    } catch (err) {
      console.error('Control request failed:', err);
    } finally {
      if (action === 'cancel') setCancelling(false);
    }
  }, [jobId, setProcessingState, stopPolling]);

  const startTranscription = useCallback(async () => {
    // Prevent a second job from being started while one is already running
    // (e.g. remounting the view while a job is still in flight).
    if (!uploadedFile || hasStarted.current || useAppStore.getState().isProcessing) return;
    hasStarted.current = true;
    startTimeRef.current = Date.now();
    setPaused(false);

    setProcessingState({
      isProcessing: true,
      processingProgress: 0,
      processingStatus: 'Uploading audio file...',
      chunksTotal: 0,
      chunksDone: 0,
      currentChunkIndex: 0,
      jobId: null,
    });

    try {
      setProcessingState({
        processingStatus: 'Starting transcription...',
      });

      const controller = new AbortController();
      abortRef.current = controller;

      const data = await startTranscriptionWithSignal(
        { file: uploadedFile, model: selectedModel, chunkDuration, overlapDuration },
        controller.signal
      );

      if (!data.jobId) {
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Failed: transcription job could not be started.',
        });
        return;
      }

      try {
        localStorage.setItem(ACTIVE_JOB_KEY, data.jobId);
      } catch {}

      setProcessingState({
        processingStatus: 'Waiting for the model to start...',
        jobId: data.jobId,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Cancelled by user',
        });
        return;
      }
      if (err instanceof ApiError) {
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${err.message}${err.errorType ? ` [${err.errorType}]` : ''}`,
        });
        return;
      }
      console.error('Transcription error:', err);
      setProcessingState({
        isProcessing: false,
        processingStatus: `Error: ${err instanceof Error ? err.message : 'Network error. Please check your connection and try again.'}`,
      });
    } finally {
      abortRef.current = null;
    }
  }, [uploadedFile, selectedModel, chunkDuration, overlapDuration, setProcessingState]);

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const job = await getJob(id);
      if (!job || !job.status) return;

      const liveResults: ChunkResult[] = parseChunkResults(job) as ChunkResult[];

      setPaused(job.controlStatus === 'paused');

      setProcessingState({
        processingProgress: job.progress ?? 0,
        chunksTotal: job.chunksTotal ?? 0,
        chunksDone: job.chunksDone ?? 0,
        liveChunkResults: liveResults,
        processingStatus: job.status === 'processing'
          ? job.controlStatus === 'paused'
            ? 'Paused — press Resume to continue'
            : job.chunksDone >= job.chunksTotal && job.chunksTotal > 0
              ? 'Deduplicating overlaps & finalizing merged transcript...'
              : `Transcribing segment ${Math.min(job.chunksDone + 1, job.chunksTotal)}/${job.chunksTotal}...`
          : job.status === 'chunking'
            ? 'Splitting audio into chunks with FFmpeg...'
            : job.status === 'completed'
              ? 'Deduplicating overlaps & finalizing merged transcript...'
              : job.status === 'failed'
                ? job.errorMessage || 'Transcription failed'
                : job.status,
      });

      if (job.status === 'completed' && job.result) {
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        const result: TranscriptionResult | null = parseJobResult(job);
        if (result && result.segments.length > 0) {
          setPaused(false);
          setProcessingState({
            isProcessing: false,
            processingProgress: 100,
            processingStatus: 'Transcription complete!',
          });

          setTranscriptionResult(result.segments, result.fullText, job.id, result.skippedChunks);
          setCurrentView('result');
        }
      }

      if (job.status === 'failed') {
        stopPolling();
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        setPaused(false);
        const errMsg = job.errorMessage || 'Transcription failed';
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('limit: 0')) {
          setDisabledModel(job.model, 'Rate Limit (429) / Quota Exhausted');
        }
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${errMsg}`,
        });
      }

      if (job.status === 'cancelled') {
        stopPolling();
        try { localStorage.removeItem(ACTIVE_JOB_KEY); } catch {}
        setPaused(false);
        setProcessingState({
          isProcessing: false,
          processingProgress: job.progress ?? 0,
          processingStatus: 'Cancelled by user',
        });
      }
    } catch (err) {
      console.error('Job polling error:', err);
    }
  }, [setProcessingState, setTranscriptionResult, setCurrentView, stopPolling]);

  useEffect(() => {
    if (uploadedFile && !hasStarted.current) {
      startTranscription();
    }
  }, [uploadedFile, startTranscription]);

  useEffect(() => {
    if (!jobId) return;

    const tick = async () => {
      await pollJobStatus(jobId);
    };

    tick();
    pollingRef.current = setInterval(tick, 2500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobId, pollJobStatus]);

  return {
    uploadedFile,
    uploadedFileName,
    modelInfo,
    selectedModel,
    isProcessing,
    processingProgress,
    processingStatus,
    chunksTotal,
    chunksDone,
    liveChunkResults,
    paused,
    cancelling,
    confirmCancelOpen,
    confirmPauseOpen,
    setConfirmCancelOpen,
    setConfirmPauseOpen,
    estimatedTime,
    isLocationError,
    isAuthError,
    isCancelled,
    isFailed,
    sendControl,
    setCurrentView,
    startTranscription,
    resetAndGoBack: () => {
      hasStarted.current = false;
      setCurrentView('upload');
    },
    resetAndOpenSettings: () => {
      hasStarted.current = false;
      setCurrentView('settings');
    },
    resetAndRetry: () => {
      hasStarted.current = false;
      startTranscription();
    },
  };
}
