'use client';

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { controlJob, startTranscriptionWithSignal, ApiError } from '@/lib/api';
import type { JobAction } from '@/lib/api';

const ACTIVE_JOB_KEY = 'autoscribe_active_job_id';

/**
 * Owns the user-facing actions for a single-file transcription: starting the
 * job, sending pause/resume/cancel controls, and local UI state (dialogs).
 * Progress polling is handled globally by <JobPoller/> in the root layout, so
 * the job keeps reporting status even when the user navigates away.
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
    paused,
    setProcessingState,
    availableModels,
    setDisabledModel,
  } = useAppStore();
  const router = useRouter();

  const hasStarted = useRef(false);
  const startTimeRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);

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
  const isLocationError = processingStatus.includes('not available in your region') || (processingStatus.includes('location') && processingStatus.includes('not supported'));
  const isAuthError = processingStatus.includes('API key') && (processingStatus.includes('not valid') || processingStatus.includes('invalid') || processingStatus.includes('revoked'));
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
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Cancelled by user',
        });
      } else if (action === 'pause') {
        setProcessingState({ paused: true, processingStatus: 'Paused — press Resume to continue' });
      } else if (action === 'resume') {
        setProcessingState({ paused: false, processingStatus: 'Resuming transcription...' });
      }
    } catch (err) {
      console.error('Control request failed:', err);
    } finally {
      if (action === 'cancel') setCancelling(false);
    }
  }, [jobId, setProcessingState]);

  const startTranscription = useCallback(async () => {
    // Prevent a second job from being started while one is already running
    // (e.g. remounting the view while a job is still in flight).
    if (!uploadedFile || hasStarted.current || useAppStore.getState().isProcessing) return;
    hasStarted.current = true;
    startTimeRef.current = Date.now();

    setProcessingState({
      isProcessing: true,
      paused: false,
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
      console.error('Transcription error (raw):', err);
      setProcessingState({
        isProcessing: false,
        processingStatus: 'Failed: could not start transcription. Please check your connection and try again.',
      });
    } finally {
      abortRef.current = null;
    }
  }, [uploadedFile, selectedModel, chunkDuration, overlapDuration, setProcessingState]);

  useEffect(() => {
    if (uploadedFile && !hasStarted.current) {
      startTranscription();
    }
  }, [uploadedFile, startTranscription]);

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
    setCurrentView: (view: 'upload' | 'processing' | 'result') => useAppStore.getState().setCurrentView(view),
    startTranscription,
    resetAndGoBack: () => {
      hasStarted.current = false;
      router.push('/');
    },
    resetAndOpenSettings: () => {
      hasStarted.current = false;
      router.push('/settings');
    },
    resetAndRetry: () => {
      hasStarted.current = false;
      startTranscription();
    },
  };
}

