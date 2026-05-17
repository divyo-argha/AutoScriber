'use client';

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, FileAudio, Cpu, Cloud, Clock, AlertTriangle, Globe, Settings, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionResult } from '@/lib/transcriber/types';

export function ProcessingView() {
  const {
    uploadedFile,
    uploadedFileName,
    selectedModel,
    geminiApiKey,
    geminiApiBaseUrl,
    ollamaUrl,
    chunkDuration,
    overlapDuration,
    isProcessing,
    processingProgress,
    processingStatus,
    chunksTotal,
    chunksDone,
    setProcessingState,
    setTranscriptionResult,
    setCurrentView,
    availableModels,
  } = useAppStore();

  const hasStarted = useRef(false);
  const startTimeRef = useRef<number>(0);

  const estimatedTime = useMemo(() => {
    if (!isProcessing || processingProgress <= 0 || processingProgress >= 100) return '';
    const elapsed = Date.now() - startTimeRef.current;
    const rate = processingProgress / elapsed;
    const remaining = (100 - processingProgress) / rate;
    if (remaining > 0) {
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
  const isFailed = !isProcessing && (
    processingStatus.startsWith('Failed') || processingStatus.startsWith('Error')
  );

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
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('model', selectedModel);
      formData.append('geminiApiKey', geminiApiKey);
      formData.append('geminiApiBaseUrl', geminiApiBaseUrl);
      formData.append('ollamaUrl', ollamaUrl);
      formData.append('chunkDuration', String(chunkDuration));
      formData.append('overlapDuration', String(overlapDuration));

      setProcessingState({
        processingStatus: 'Splitting audio into chunks...',
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Server returned an error status
        const errorMsg = data.error || `Server error (${response.status})`;
        const errorType = data.errorType || '';
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${errorMsg}${errorType ? ` [${errorType}]` : ''}`,
        });
        return;
      }

      if (data.status === 'completed' && data.result) {
        const result: TranscriptionResult = data.result;

        // Validate that segments actually exist
        if (!result.segments || result.segments.length === 0) {
          setProcessingState({
            isProcessing: false,
            processingStatus: 'Failed: Transcription produced no results. The audio may be empty or too quiet to transcribe.',
          });
          return;
        }

        setProcessingState({
          isProcessing: false,
          processingProgress: 100,
          processingStatus: 'Transcription complete!',
        });

        setTranscriptionResult(result.segments, result.fullText, data.jobId);

        setTimeout(() => {
          setCurrentView('result');
        }, 800);
      } else if (data.status === 'failed') {
        const errorMsg = data.error || 'Transcription failed';
        const errorType = data.errorType || '';
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${errorMsg}${errorType ? ` [${errorType}]` : ''}`,
        });
      } else {
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${data.error || 'Unexpected response from server'}`,
        });
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setProcessingState({
        isProcessing: false,
        processingStatus: `Error: ${err instanceof Error ? err.message : 'Network error. Please check your connection and try again.'}`,
      });
    }
  }, [uploadedFile, selectedModel, geminiApiKey, geminiApiBaseUrl, ollamaUrl, chunkDuration, overlapDuration, setProcessingState, setTranscriptionResult, setCurrentView]);

  useEffect(() => {
    if (uploadedFile && !hasStarted.current) {
      startTranscription();
    }
  }, [uploadedFile, startTranscription]);

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
              {isProcessing ? 'Transcribing Audio' : processingProgress === 100 ? 'Complete!' : isFailed ? 'Transcription Failed' : 'Processing'}
            </h2>
            {!isFailed && (
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

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={processingProgress} className="h-2.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{processingProgress}%</span>
              <span>
                {chunksTotal > 0 ? `Chunk ${chunksDone}/${chunksTotal}` : 'Preparing...'}
              </span>
            </div>
          </div>

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
                            <p className="text-xs opacity-70">Switch to a local Ollama model (e.g., gemma3:4b). Go to Settings → Local to set up Ollama.</p>
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
    </div>
  );
}
