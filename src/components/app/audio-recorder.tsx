'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Pause, Play, Square, AlertCircle } from 'lucide-react';
import { SoundWaveIndicator } from './sound-wave-indicator';

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface AudioRecorderProps {
  onRecordingComplete: (file: File, blob: Blob) => void;
  onCancel: () => void;
}

function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(60).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  /** Safely close the AudioContext, ignoring if already closed */
  const closeAudioContext = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== 'closed') {
      try {
        ctx.close();
      } catch {
        // Ignore errors from already-closed contexts
      }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceNodeRef.current = null;
  }, []);

  /** Stop the animation loop */
  const stopAnimationLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  /** Stop the timer */
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Stop all media stream tracks */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  /** Audio level monitoring loop */
  const startAudioMonitoring = useCallback(() => {
    const updateLevel = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(avg / 255);
        setWaveform(prev => [...prev.slice(1), avg / 255]);
      }
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, []);
  
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access with minimal constraints for best quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        },
      });
      
      streamRef.current = stream;
      
      // Set up audio analyser for waveform visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Start recording with 100ms timeslice for frequent data collection
      mediaRecorder.start(100);
      setStatus('recording');
      setDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Start audio level monitoring
      startAudioMonitoring();
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [startAudioMonitoring]);
  
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      stopTimer();
      stopAnimationLoop();
    }
  }, [status, stopTimer, stopAnimationLoop]);
  
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      startAudioMonitoring();
    }
  }, [status, startAudioMonitoring]);
  
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    // Stop timer and animation immediately
    stopTimer();
    stopAnimationLoop();
    setAudioLevel(0);
    setStatus('stopped');

    // Stop the media stream tracks right away (no more audio input)
    stopStream();

    // Set up the onstop handler: MediaRecorder fires onstop AFTER
    // the final ondataavailable, so chunksRef is guaranteed to be complete.
    recorder.onstop = () => {
      const collectedChunks = chunksRef.current;
      if (collectedChunks.length === 0) {
        setError('No audio data was recorded. Please check your microphone and try again.');
        return;
      }

      const actualMimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(collectedChunks, { type: actualMimeType });
      const ext = actualMimeType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `recording_${Date.now()}.${ext}`, { type: actualMimeType });

      // Close AudioContext only after recording is fully done
      closeAudioContext();

      onRecordingComplete(file, blob);

      // Clear chunks for next recording
      chunksRef.current = [];
    };

    // Request any remaining data, then stop — triggers onstop after final ondataavailable
    try {
      recorder.requestData();
    } catch {
      // Some browsers throw if already stopped
    }
    recorder.stop();
  }, [onRecordingComplete, stopTimer, stopAnimationLoop, stopStream, closeAudioContext]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopAnimationLoop();
      stopStream();
      closeAudioContext();
      
      // If there's an active recorder, stop it (without callback)
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, [stopTimer, stopAnimationLoop, stopStream, closeAudioContext]);
  
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isActive = isRecording || isPaused;
  
  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-6">
        {/* Waveform / Status Display */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md h-24 rounded-xl bg-muted/50 overflow-hidden flex items-center justify-center">
            {isActive ? (
              <div className="flex items-center gap-[2px] h-full px-4 py-4">
                {waveform.map((level, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[3px] rounded-full bg-emerald-500 transition-all duration-75"
                    style={{
                      height: `${Math.max(4, level * 100)}%`,
                      opacity: 0.4 + level * 0.6,
                    }}
                  />
                ))}
              </div>
            ) : status === 'stopped' ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Recording saved</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Mic className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ready to record</span>
              </div>
            )}
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-red-500">REC</span>
              </div>
            )}
            {isPaused && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-amber-500">PAUSED</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Timer */}
        <div className="text-center">
          <span className="text-3xl font-mono font-bold tracking-wider">
            {formatTimer(duration)}
          </span>
        </div>
        
        {/* Audio Level Indicator */}
        {isActive && (
          <div className="flex items-center gap-3 justify-center">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <SoundWaveIndicator audioLevel={audioLevel} isActive={isActive} />
            <span className="text-xs text-muted-foreground">{Math.round(audioLevel * 100)}%</span>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {status === 'idle' && (
            <>
              <Button
                onClick={startRecording}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 px-6"
              >
                <Mic className="w-5 h-5" />
                Start Recording
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
          
          {isRecording && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={pauseRecording}
                className="h-12 w-12 rounded-full"
              >
                <Pause className="w-5 h-5" />
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
              >
                <Square className="w-5 h-5" />
              </Button>
            </>
          )}
          
          {isPaused && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={resumeRecording}
                className="h-12 w-12 rounded-full"
              >
                <Play className="w-5 h-5" />
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
              >
                <Square className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
        
        {/* Tip */}
        {status === 'idle' && (
          <p className="text-xs text-center text-muted-foreground">
            Click &quot;Start Recording&quot; to begin. Your microphone will be used to capture audio directly.
          </p>
        )}
        {isActive && (
          <p className="text-xs text-center text-muted-foreground">
            {isRecording ? 'Recording in progress...' : 'Recording paused.'} Click the stop button when you&apos;re done.
          </p>
        )}
      </div>
    </Card>
  );
}
