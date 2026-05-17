'use client';

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, FileAudio, Cpu, Cloud, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptionResult } from '@/lib/transcriber/types';

export function ProcessingView() {
  const {
    uploadedFile,
    uploadedFileName,
    selectedModel,
    geminiApiKey,
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
      
      if (data.status === 'completed' && data.result) {
        const result: TranscriptionResult = data.result;
        
        setProcessingState({
          isProcessing: false,
          processingProgress: 100,
          processingStatus: 'Transcription complete!',
        });
        
        setTranscriptionResult(result.segments, result.fullText);
        
        setTimeout(() => {
          setCurrentView('result');
        }, 800);
      } else {
        setProcessingState({
          isProcessing: false,
          processingStatus: `Failed: ${data.error || 'Unknown error'}`,
        });
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setProcessingState({
        isProcessing: false,
        processingStatus: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }, [uploadedFile, selectedModel, geminiApiKey, ollamaUrl, chunkDuration, overlapDuration, setProcessingState, setTranscriptionResult, setCurrentView]);
  

  
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
            ) : processingStatus.startsWith('Failed') || processingStatus.startsWith('Error') ? (
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
              {isProcessing ? 'Transcribing Audio' : processingProgress === 100 ? 'Complete!' : 'Processing'}
            </h2>
            <p className="text-sm text-muted-foreground">{processingStatus}</p>
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
          {!isProcessing && (processingStatus.startsWith('Failed') || processingStatus.startsWith('Error')) && (
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
          )}
        </div>
      </Card>
    </div>
  );
}
