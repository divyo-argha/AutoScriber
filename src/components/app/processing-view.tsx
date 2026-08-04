'use client';

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, FileAudio, Cpu, Cloud, Clock, AlertTriangle, Globe, Settings, Wifi, Pause, Play, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionResult } from '@/lib/transcriber/types';

export function ProcessingView() {
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
  } = useAppStore();

  const hasStarted = useRef(false);
  const startTimeRef = useRef<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [paused, setPaused] = useState(false);
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
  const isLocationError = processingStatus.includes('location') && processingStatus.includes('not supported');
  const isAuthError = processingStatus.includes('API key') && (processingStatus.includes('not valid') || processingStatus.includes('invalid'));
  const isCancelled = !isProcessing && processingStatus.startsWith('Cancelled');
  const isFailed = !isProcessing && !isCancelled && (
    processingStatus.startsWith('Failed') || processingStatus.startsWith('Error')
  );

  // Pause, resume, or cancel the running job via the control API
  const sendControl = useCallback(async (action: 'pause' | 'resume' | 'cancel') => {
    if (!jobId) return;
    if (action === 'cancel') {
      setCancelling(true);
      try {
        localStorage.removeItem('autoscribe_active_job_id');
      } catch {}
    }
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, action }),
      });
      if (res.ok) {
        if (action === 'cancel') {
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
      }
    } catch (err) {
      console.error('Control request failed:', err);
    } finally {
      if (action === 'cancel') setCancelling(false);
    }
  }, [jobId, setProcessingState]);

  const goBackToUpload = useCallback(() => {
    hasStarted.current = false;
    setCurrentView('upload');
  }, [setCurrentView]);

  const startTranscription = useCallback(async () => {
    if (!uploadedFile || hasStarted.current) return;
    hasStarted.current = true;
    startTimeRef.current = Date.now();

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
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('model', selectedModel);
      formData.append('chunkDuration', String(chunkDuration));
      formData.append('overlapDuration', String(overlapDuration));

      setProcessingState({
        processingStatus: 'Starting transcription...',
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `Server error (${response.status})`;
        const errorType = data.errorType || '';
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${errorMsg}${errorType ? ` [${errorType}]` : ''}`,
        });
        return;
      }

      if (!data.jobId) {
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Failed: transcription job could not be started.',
        });
        return;
      }

      try {
        localStorage.setItem('autoscribe_active_job_id', data.jobId);
      } catch {}

      setProcessingState({
        processingStatus: 'Waiting for the model to start...',
        jobId: data.jobId,
      });
    } catch (err) {
      console.error('Transcription error:', err);
      setProcessingState({
        isProcessing: false,
        processingStatus: `Error: ${err instanceof Error ? err.message : 'Network error. Please check your connection and try again.'}`,
      });
    }
  }, [uploadedFile, selectedModel, chunkDuration, overlapDuration, setProcessingState]);

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/jobs?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const job = await res.json();

      if (!job || !job.status) return;

      let liveResults: import('@/lib/transcriber/types').ChunkResult[] = [];
      if (job.chunkResults) {
        try {
          liveResults = typeof job.chunkResults === 'string' ? JSON.parse(job.chunkResults) : job.chunkResults;
        } catch {}
      }

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
        try { localStorage.removeItem('autoscribe_active_job_id'); } catch {}
        const result: TranscriptionResult = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;

        setPaused(false);
        setProcessingState({
          isProcessing: false,
          processingProgress: 100,
          processingStatus: 'Transcription complete!',
        });

        setTranscriptionResult(result.segments, result.fullText, job.id, result.skippedChunks);
        setCurrentView('result');
      }

      if (job.status === 'failed') {
        try { localStorage.removeItem('autoscribe_active_job_id'); } catch {}
        setPaused(false);
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${job.errorMessage || 'Transcription failed'}`,
        });
      }

      if (job.status === 'cancelled') {
        try { localStorage.removeItem('autoscribe_active_job_id'); } catch {}
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
  }, [setProcessingState, setTranscriptionResult, setCurrentView]);

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

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="p-6 sm:p-8">
        <div className="space-y-6">
          {/* Status Icon */}
          <div className="flex items-center justify-center">
            {isProcessing ? (
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-emerald-50 dark:bg-emerald-950/30 animate-pulse" />
                <Loader2 className="relative w-10 h-10 text-emerald-600 animate-spin" />
              </div>
            ) : processingProgress === 100 ? (
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
            ) : isCancelled ? (
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-950/30">
                <Ban className="w-10 h-10 text-amber-600" />
              </div>
            ) : isFailed ? (
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-destructive/10">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-muted">
                <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>

          {/* Status Text */}
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">
              {isProcessing ? 'Transcribing Audio' : processingProgress === 100 ? 'Complete!' : isCancelled ? 'Transcription Cancelled' : isFailed ? 'Transcription Failed' : 'Processing'}
            </h2>
            {!isFailed && !isCancelled && (
              <p className="text-sm text-muted-foreground">
                {processingStatus}
              </p>
            )}
            {isProcessing && estimatedTime && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {estimatedTime}
              </div>
            )}
          </div>

          {/* Single Unified Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-medium text-foreground">
              <span>Progress</span>
              <span>
                {processingProgress}%
                {chunksTotal > 0 && (
                  <span className="text-muted-foreground ml-1.5 font-normal">
                    ({Math.min(chunksDone, chunksTotal)}/{chunksTotal} Chunks)
                  </span>
                )}
              </span>
            </div>
            <Progress value={processingProgress} className="h-2.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">Status: {processingStatus}</span>
            </div>
          </div>

          {/* Pause / Resume / Cancel controls */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant={paused ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (paused) {
                    sendControl('resume');
                  } else {
                    setConfirmPauseOpen(true);
                  }
                }}
                disabled={cancelling}
                className={`gap-1.5 min-w-[110px] ${paused ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={cancelling}
                className="gap-1.5 min-w-[110px]"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            </div>
          )}
          {paused && isProcessing && (
            <p className="text-xs text-muted-foreground text-center">
              Paused — the current chunk finishes, then transcription holds until you press Resume.
            </p>
          )}

          {/* File & Model Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <FileAudio className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{uploadedFileName}</p>
                <p className="text-[10px] text-muted-foreground">Audio File</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              {modelInfo?.provider === 'gemini' ? (
                <Cloud className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{modelInfo?.name || selectedModel}</p>
                <p className="text-[10px] text-muted-foreground">
                  {modelInfo?.provider === 'gemini' ? 'Cloud API' : 'Local Model'}
                </p>
              </div>
            </div>
          </div>

          {/* Live Per-Segment Transcription Results */}
          {liveChunkResults && liveChunkResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Live Segment Transcriptions ({liveChunkResults.length} Ready)
                </h3>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-border/20">
                {liveChunkResults.map((chunkRes, idx) => (
                  <div key={idx} className="pt-2 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Segment {chunkRes.chunkIndex + 1}
                      </span>
                      <span>{chunkRes.segments.length} dialogue turns</span>
                    </div>
                    <div className="space-y-1 bg-muted/30 p-2.5 rounded-md text-foreground">
                      {chunkRes.segments.slice(0, 3).map((seg, sIdx) => (
                        <p key={sIdx} className="truncate text-[11.5px]">
                          <span className="font-medium text-muted-foreground mr-1">
                            [{Math.floor(seg.startTime / 60)}m{Math.floor(seg.startTime % 60)}s] {seg.speaker}:
                          </span>
                          {seg.text}
                        </p>
                      ))}
                      {chunkRes.segments.length > 3 && (
                        <p className="text-[10px] text-muted-foreground italic">
                          + {chunkRes.segments.length - 3} more segments in this {chunkDuration}s chunk...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Steps */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2 overflow-hidden"
              >
                {[
                  { label: 'Upload audio', done: processingProgress > 0 },
                  { label: 'Split into chunks', done: chunksTotal > 0 },
                  { label: 'Transcribe chunks', done: processingProgress > 50 },
                  { label: 'Assemble results', done: processingProgress === 100 },
                ].map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    <motion.div
                      animate={{
                        backgroundColor: step.done ? '#10b981' : 'rgba(120,120,120,0.3)',
                        scale: step.done ? [1, 1.3, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-2 h-2 rounded-full"
                    />
                    <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Cancelled Actions */}
          {isCancelled && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium">Transcription Cancelled</p>
                  <p className="text-xs mt-1 opacity-80">The job was cancelled. {chunksDone > 0 ? `${chunksDone} of ${chunksTotal} chunk(s) had been transcribed.` : 'No chunks were transcribed.'} No result was saved.</p>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={goBackToUpload}>
                  Go Back
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    hasStarted.current = false;
                    startTranscription();
                  }}
                >
                  Start New Transcription
                </Button>
              </div>
            </div>
          )}

          {/* Error Actions */}
          {isFailed && (
            <div className="space-y-3">
              {/* Location-specific error */}
              {isLocationError ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
                    <Globe className="w-5 h-5 mt-0.5 shrink-0" />
                    <div className="min-w-0 space-y-2">
                      <p className="font-semibold">Gemini API is not available in your region</p>
                      <p className="text-xs opacity-80">
                        Google restricts the Gemini API in certain countries. You have two options to fix this:
                      </p>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-start gap-2 p-2 rounded bg-amber-100/50 dark:bg-amber-900/20">
                          <Wifi className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Option 1: Use a Proxy</p>
                            <p className="text-xs opacity-70">Set up a proxy URL in Settings → Cloud → API Base URL to route through a supported region.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-amber-100/50 dark:bg-amber-900/20">
                          <Cpu className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Option 2: Use Local Model</p>
                            <p className="text-xs opacity-70">Check your API key in Settings.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                      }}
                    >
                      Go Back
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                        // Open settings dialog - we'll dispatch a custom event
                        window.dispatchEvent(new CustomEvent('open-settings'));
                      }}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Open Settings
                    </Button>
                  </div>
                </div>
              ) : isAuthError ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Invalid API Key</p>
                      <p className="text-xs mt-1 opacity-80">Your Gemini API key appears to be invalid. Please check your key in Settings and try again.</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                      }}
                    >
                      Go Back
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                        window.dispatchEvent(new CustomEvent('open-settings'));
                      }}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Open Settings
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Transcription Failed</p>
                      <p className="text-xs mt-1 opacity-80 break-words">{processingStatus.replace(/^(Failed|Error):\s*/, '')}</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                      }}
                    >
                      Go Back
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        hasStarted.current = false;
                        startTranscription();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Cancel Confirmation Modal */}
      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-5 h-5" />
              Cancel Transcription?
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground">
              Are you sure you want to stop transcribing <strong>{uploadedFileName || 'this audio file'}</strong>? Progress for this job will be cancelled immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4 flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)}>
              Keep Transcribing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmCancelOpen(false);
                sendControl('cancel');
              }}
            >
              Cancel Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Confirmation Modal */}
      <Dialog open={confirmPauseOpen} onOpenChange={setConfirmPauseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Pause className="w-5 h-5 text-amber-500" />
              Pause Transcription?
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground">
              Pause processing at the current segment? You can resume transcription at any time without losing completed progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4 flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmPauseOpen(false)}>
              Continue Transcribing
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setConfirmPauseOpen(false);
                sendControl('pause');
              }}
            >
              Pause Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
