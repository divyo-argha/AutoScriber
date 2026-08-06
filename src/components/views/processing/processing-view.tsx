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
import styles from './processing-view.module.css';

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
  const sendControl = useCallback(async (action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel') {
      setCancelling(true);
      try {
        localStorage.removeItem('autoscribe_active_job_id');
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
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, action }),
      });
      if (res.ok) {
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
      }
    } catch (err) {
      console.error('Control request failed:', err);
    } finally {
      if (action === 'cancel') setCancelling(false);
    }
  }, [jobId, setProcessingState, stopPolling]);

  const goBackToUpload = useCallback(() => {
    hasStarted.current = false;
    setCurrentView('upload');
  }, [setCurrentView]);

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
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('model', selectedModel);
      formData.append('chunkDuration', String(chunkDuration));
      formData.append('overlapDuration', String(overlapDuration));

      setProcessingState({
        processingStatus: 'Starting transcription...',
      });

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProcessingState({
          isProcessing: false,
          processingStatus: 'Cancelled by user',
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
        stopPolling();
        try { localStorage.removeItem('autoscribe_active_job_id'); } catch {}
        setPaused(false);
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${job.errorMessage || 'Transcription failed'}`,
        });
      }

      if (job.status === 'cancelled') {
        stopPolling();
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

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <div className={styles.inner}>
          {/* Status Icon */}
          <div className={styles.iconWrap}>
            {isProcessing ? (
              <div className={styles.spinnerWrap}>
                <div className={styles.pulseRing} />
                <Loader2 className={`${styles.bigIcon} ${styles.iconGreen} ${styles.spinner}`} />
              </div>
            ) : processingProgress === 100 ? (
              <div className={`${styles.iconBox} ${styles.iconBoxGreen}`}>
                <CheckCircle2 className={`${styles.bigIcon} ${styles.iconGreen}`} />
              </div>
            ) : isCancelled ? (
              <div className={`${styles.iconBox} ${styles.iconBoxAmber}`}>
                <Ban className={`${styles.bigIcon} ${styles.iconAmber}`} />
              </div>
            ) : isFailed ? (
              <div className={`${styles.iconBox} ${styles.iconBoxDestructive}`}>
                <XCircle className={`${styles.bigIcon} ${styles.iconDestructive}`} />
              </div>
            ) : (
              <div className={`${styles.iconBox} ${styles.iconBoxMuted}`}>
                <Loader2 className={`${styles.bigIcon} ${styles.iconMuted} ${styles.spinner}`} />
              </div>
            )}
          </div>

          {/* Status Text */}
          <div className={styles.statusCenter}>
            <h2 className={styles.statusTitle}>
              {isProcessing ? 'Transcribing Audio' : processingProgress === 100 ? 'Complete!' : isCancelled ? 'Transcription Cancelled' : isFailed ? 'Transcription Failed' : 'Processing'}
            </h2>
            {!isFailed && !isCancelled && (
              <p className={styles.statusText}>
                {processingStatus}
              </p>
            )}
            {isProcessing && estimatedTime && (
              <div className={styles.etaRow}>
                <Clock className={styles.iconXs} />
                {estimatedTime}
              </div>
            )}
          </div>

          {/* Single Unified Progress Bar */}
          <div className={styles.progressGroup}>
            <div className={styles.progressHeader}>
              <span>Progress</span>
              <span>
                {processingProgress}%
                {chunksTotal > 0 && (
                  <span className={styles.chunkMeta}>
                    ({Math.min(chunksDone, chunksTotal)}/{chunksTotal} Chunks)
                  </span>
                )}
              </span>
            </div>
            <Progress value={processingProgress} className={styles.progressBar} />
            <div className={styles.statusRow}>
              <span className={styles.statusRowText}>Status: {processingStatus}</span>
            </div>
          </div>

          {/* Pause / Resume / Cancel controls */}
          {isProcessing && (
            <div className={styles.controls}>
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
                className={`${styles.controlBtn} ${paused ? styles.pauseResumeActive : ''}`}
              >
                {paused ? <Play className={styles.iconSm} /> : <Pause className={styles.iconSm} />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={cancelling}
                className={styles.controlBtn}
              >
                {cancelling ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Ban className={styles.iconSm} />}
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
            </div>
          )}
          {paused && isProcessing && (
            <p className={styles.pausedHint}>
              Paused — the current chunk finishes, then transcription holds until you press Resume.
            </p>
          )}

          {/* File & Model Info */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <FileAudio className={styles.infoIcon} />
              <div className={styles.infoInner}>
                <p className={styles.infoName}>{uploadedFileName}</p>
                <p className={styles.infoLabel}>Audio File</p>
              </div>
            </div>
            <div className={styles.infoItem}>
              {modelInfo?.provider === 'gemini' ? (
                <Cloud className={styles.infoIcon} />
              ) : (
                <Cpu className={styles.infoIcon} />
              )}
              <div className={styles.infoInner}>
                <p className={styles.infoName}>{modelInfo?.name || selectedModel}</p>
                <p className={styles.infoLabel}>
                  {modelInfo?.provider === 'gemini' ? 'Cloud API' : 'Local Model'}
                </p>
              </div>
            </div>
          </div>

          {/* Live Per-Segment Transcription Results */}
          {liveChunkResults && liveChunkResults.length > 0 && (
            <div className={styles.liveSection}>
              <div className={styles.liveHeader}>
                <h3 className={styles.liveTitle}>
                  <CheckCircle2 className={styles.liveTitleIcon} />
                  Live Segment Transcriptions ({liveChunkResults.length} Ready)
                </h3>
              </div>
              <div className={styles.liveList}>
                {liveChunkResults.map((chunkRes, idx) => (
                  <div key={idx} className={styles.liveItem}>
                    <div className={styles.liveMeta}>
                      <span className={styles.liveSegName}>
                        Segment {chunkRes.chunkIndex + 1}
                      </span>
                      <span>{chunkRes.segments.length} dialogue turns</span>
                    </div>
                    <div className={styles.liveSegBlock}>
                      {chunkRes.segments.slice(0, 3).map((seg, sIdx) => (
                        <p key={sIdx} className={styles.liveSegLine}>
                          <span className={styles.liveSegSpeaker}>
                            [{Math.floor(seg.startTime / 60)}m{Math.floor(seg.startTime % 60)}s] {seg.speaker}:
                          </span>
                          {seg.text}
                        </p>
                      ))}
                      {chunkRes.segments.length > 3 && (
                        <p className={styles.liveMore}>
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
                className={styles.steps}
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
                    className={styles.stepRow}
                  >
                    <motion.div
                      animate={{
                        backgroundColor: step.done ? '#10b981' : 'rgba(120,120,120,0.3)',
                        scale: step.done ? [1, 1.3, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className={styles.stepDot}
                    />
                    <span className={step.done ? styles.stepDone : styles.stepPending}>{step.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Cancelled Actions */}
          {isCancelled && (
            <div className={styles.actionBox}>
              <div className={styles.warningBox}>
                <AlertTriangle className={styles.warningIcon} />
                <div className={styles.messageInner}>
                  <p className={styles.messageTitle}>Transcription Cancelled</p>
                  <p className={styles.messageSub}>The job was cancelled. {chunksDone > 0 ? `${chunksDone} of ${chunksTotal} chunk(s) had been transcribed.` : 'No chunks were transcribed.'} No result was saved.</p>
                </div>
              </div>
              <div className={styles.actionRow}>
                <Button variant="outline" onClick={goBackToUpload}>
                  Go Back
                </Button>
                <Button
                  className={styles.primaryBtn}
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
            <div className={styles.actionBox}>
              {/* Location-specific error */}
              {isLocationError ? (
                <div className={styles.actionBox}>
                  <div className={styles.locationBox}>
                    <Globe className={styles.locationIcon} />
                    <div className={styles.locationInner}>
                      <p className={styles.messageTitle}>Gemini API is not available in your region</p>
                      <p className={styles.messageSub}>
                        Google restricts the Gemini API in certain countries. You have two options to fix this:
                      </p>
                      <div className={styles.actionBox}>
                        <div className={styles.optionRow}>
                          <Wifi className={styles.optionIcon} />
                          <div>
                            <p className={styles.optionTitle}>Option 1: Use a Proxy</p>
                            <p className={styles.optionSub}>Set up a proxy URL in Settings → Cloud → API Base URL to route through a supported region.</p>
                          </div>
                        </div>
                        <div className={styles.optionRow}>
                          <Cpu className={styles.optionIcon} />
                          <div>
                            <p className={styles.optionTitle}>Option 2: Use Local Model</p>
                            <p className={styles.optionSub}>Check your API key in Settings.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
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
                      className={`${styles.primaryBtn} ${styles.btnGap}`}
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                        // Open settings dialog - we'll dispatch a custom event
                        window.dispatchEvent(new CustomEvent('open-settings'));
                      }}
                    >
                      <Settings className={styles.iconSm} />
                      Open Settings
                    </Button>
                  </div>
                </div>
              ) : isAuthError ? (
                <div className={styles.actionBox}>
                  <div className={styles.errorBox}>
                    <AlertTriangle className={styles.errorIcon} />
                    <div className={styles.messageInner}>
                      <p className={styles.messageTitle}>Invalid API Key</p>
                      <p className={styles.messageSub}>Your Gemini API key appears to be invalid. Please check your key in Settings and try again.</p>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
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
                      className={`${styles.primaryBtn} ${styles.btnGap}`}
                      onClick={() => {
                        hasStarted.current = false;
                        setCurrentView('upload');
                        window.dispatchEvent(new CustomEvent('open-settings'));
                      }}
                    >
                      <Settings className={styles.iconSm} />
                      Open Settings
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actionBox}>
                  <div className={styles.errorBox}>
                    <AlertTriangle className={styles.errorIcon} />
                    <div className={styles.messageInner}>
                      <p className={styles.messageTitle}>Transcription Failed</p>
                      <p className={styles.messageSub}>{processingStatus.replace(/^(Failed|Error):\s*/, '')}</p>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
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
                      className={styles.primaryBtn}
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
        <DialogContent className={styles.dialogContentSm}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitleDestructive}>
              <Ban className={styles.dialogTitleIcon} />
              Cancel Transcription?
            </DialogTitle>
            <DialogDescription className={styles.dialogDesc}>
              Are you sure you want to stop transcribing <strong>{uploadedFileName || 'this audio file'}</strong>? Progress for this job will be cancelled immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.dialogFooter}>
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
        <DialogContent className={styles.dialogContentSm}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <Pause className={styles.dialogTitleIconAmber} />
              Pause Transcription?
            </DialogTitle>
            <DialogDescription className={styles.dialogDesc}>
              Pause processing at the current segment? You can resume transcription at any time without losing completed progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={styles.dialogFooter}>
            <Button variant="outline" onClick={() => setConfirmPauseOpen(false)}>
              Continue Transcribing
            </Button>
            <Button
              className={styles.amberPrimary}
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