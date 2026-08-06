import { useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { useAppStore } from '@/lib/store';
import type { BatchJob } from '@/lib/store';
import { controlJob } from '@/lib/api';
import { downloadTranscriptClient, buildClientExport } from '@/lib/transcript/download';
import type { ClientExportFormat } from '@/lib/transcript/download';
import type { TranscriptionResult } from '@/lib/transcriber/types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 900; // ~45 minutes

/**
 * Owns the sequential batch transcription queue: starting jobs, polling their
 * progress, cancelling the whole batch, and downloading per-job / zipped output.
 */
export function useBatchQueue() {
  const { batchJobs, clearBatch, chunkDuration } = useAppStore();
  const processingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const transcribeOne = useCallback(async (job: BatchJob): Promise<{ result: TranscriptionResult; jobId: string }> => {
    const state = useAppStore.getState();
    const formData = new FormData();
    formData.append('file', job.file);
    formData.append('model', state.selectedModel);
    formData.append('chunkDuration', String(state.chunkDuration));
    formData.append('overlapDuration', String(state.overlapDuration));

    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || !data.jobId) {
      throw new Error(data.error || `Server error (${res.status})`);
    }

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      if (!mountedRef.current || stopRequestedRef.current) throw new Error('Canceled');
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(`/api/jobs?id=${encodeURIComponent(data.jobId)}`);
      if (!pollRes.ok) throw new Error('Failed to check job status');
      const jobData = await pollRes.json();

      if (jobData.status === 'completed') {
        const result: TranscriptionResult = typeof jobData.result === 'string' ? JSON.parse(jobData.result) : jobData.result;
        if (result?.segments?.length > 0) {
          return { result, jobId: data.jobId };
        }
        throw new Error('Transcription finished but produced no segments');
      }
      if (jobData.status === 'failed') {
        throw new Error(jobData.errorMessage || 'Transcription failed');
      }

      useAppStore.getState().updateBatchJob(job.id, {
        progress: Math.max(jobData.progress ?? 15, 15),
      });
    }

    throw new Error('Transcription timed out after 45 minutes');
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    stopRequestedRef.current = false;

    const jobs = useAppStore.getState().batchJobs;

    for (const job of jobs) {
      if (!mountedRef.current || stopRequestedRef.current) break;
      if (job.status !== 'queued') continue;

      useAppStore.getState().updateBatchJob(job.id, { status: 'processing', progress: 5 });

      try {
        const { result, jobId } = await transcribeOne(job);
        if (!mountedRef.current) break;
        useAppStore.getState().updateBatchJob(job.id, {
          status: 'done',
          progress: 100,
          segments: result.segments,
          fullText: result.fullText,
          jobId,
          skippedChunks: result.skippedChunks || [],
        });
      } catch (err) {
        if (!mountedRef.current) break;
        const msg = err instanceof Error ? err.message : 'Network error';
        if (msg === 'Canceled') break;
        useAppStore.getState().updateBatchJob(job.id, {
          status: 'failed',
          progress: 0,
          error: msg,
        });
      }
    }

    processingRef.current = false;
  }, [transcribeOne]);

  useEffect(() => {
    if (batchJobs.some(j => j.status === 'queued')) {
      processQueue();
    }
  }, [batchJobs, processQueue]);

  const downloadOne = useCallback((jobId: string, format: ClientExportFormat) => {
    const job = useAppStore.getState().batchJobs.find(j => j.id === jobId);
    if (!job || !job.segments.length) return;
    const base = job.file.name.replace(/\.[^/.]+$/, '');
    downloadTranscriptClient(job.segments, format, base);
  }, []);

  const downloadAll = useCallback(async () => {
    const done = useAppStore.getState().batchJobs.filter(j => j.status === 'done');
    if (!done.length) return;
    const zip = new JSZip();
    for (const job of done) {
      const base = job.file.name.replace(/\.[^/.]+$/, '');
      for (const format of ['txt', 'srt', 'md'] as const) {
        const { content } = buildClientExport(job.segments, format, base);
        zip.file(`${base}.${format}`, content);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transcriptions.zip';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }, []);

  const stopBatch = useCallback(async () => {
    stopRequestedRef.current = true;
    const state = useAppStore.getState();
    const targets = state.batchJobs.filter(j => j.status === 'processing' || j.status === 'queued');
    const processingJob = targets.find(j => j.status === 'processing');
    if (processingJob?.jobId) {
      try {
        await controlJob(processingJob.jobId, 'cancel');
      } catch {}
    }
    targets.forEach(j => state.updateBatchJob(j.id, {
      status: 'failed',
      progress: 0,
      error: 'Cancelled by user',
    }));
  }, []);

  const doneCount = useMemo(() => batchJobs.filter(j => j.status === 'done').length, [batchJobs]);
  const failedCount = useMemo(() => batchJobs.filter(j => j.status === 'failed').length, [batchJobs]);
  const totalCount = batchJobs.length;
  const anyActive = batchJobs.some(j => j.status === 'processing' || j.status === 'queued');
  const allFinished = batchJobs.every(j => j.status === 'done' || j.status === 'failed');

  return {
    batchJobs,
    chunkDuration,
    doneCount,
    failedCount,
    totalCount,
    anyActive,
    allFinished,
    downloadOne,
    downloadAll,
    stopBatch,
    clearBatch,
  };
}
