'use client';

import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Pause, Play, Square, AlertCircle } from 'lucide-react';
import { SoundWaveIndicator } from './sound-wave-indicator';
import { useToast } from '@/hooks/use-toast';
import styles from './audio-recorder.module.css';

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
  const { toast } = useToast();

  const showError = useCallback((msg: string) => {
    setError(msg);
    toast({
      variant: 'destructive',
      title: 'Audio Recorder Error',
      description: msg,
    });
  }, [toast]);
  
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
        showError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        showError('No microphone found. Please connect a microphone and try again.');
      } else {
        showError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [startAudioMonitoring, showError]);
  
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
        showError('No audio data was recorded. Please check your microphone and try again.');
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
  }, [onRecordingComplete, stopTimer, stopAnimationLoop, stopStream, closeAudioContext, showError]);
  
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
    <Card className={styles.container}>
      <div className={styles.inner}>
        {/* Waveform / Status Display */}
        <div className={styles.centerRow}>
          <div className={styles.waveBox}>
            {isActive ? (
              <div className={styles.barsRow}>
                {waveform.map((level, i) => (
                  <div
                    key={i}
                    className={styles.bar}
                    style={{
                      '--bar-height': `${Math.max(4, level * 100)}%`,
                      '--bar-opacity': `${0.4 + level * 0.6}`,
                    } as CSSProperties}
                  />
                ))}
              </div>
            ) : status === 'stopped' ? (
              <div className={styles.savedBox}>
                <div className={styles.savedDot} />
                <span className={styles.savedText}>Recording saved</span>
              </div>
            ) : (
              <div className={styles.idleBox}>
                <Mic className={styles.idleIcon} />
                <span className={styles.idleText}>Ready to record</span>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className={styles.indicator}>
                <div className={styles.recDot} />
                <span className={styles.recText}>REC</span>
              </div>
            )}
            {isPaused && (
              <div className={styles.indicator}>
                <div className={styles.pauseDot} />
                <span className={styles.pauseText}>PAUSED</span>
              </div>
            )}
          </div>
        </div>

        {/* Timer */}
        <div className={styles.timerCenter}>
          <span className={styles.timer}>
            {formatTimer(duration)}
          </span>
        </div>

        {/* Audio Level Indicator */}
        {isActive && (
          <div className={styles.levelRow}>
            <Mic className={styles.levelIcon} />
            <SoundWaveIndicator audioLevel={audioLevel} isActive={isActive} />
            <span className={styles.levelText}>{Math.round(audioLevel * 100)}%</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={styles.errorBox}>
            <AlertCircle className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          {status === 'idle' && (
            <>
              <Button
                onClick={startRecording}
                className={styles.recordBtn}
              >
                <Mic className={styles.micIcon} />
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
                className={styles.roundBtn}
              >
                <Pause className={styles.micIcon} />
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="icon"
                className={styles.stopBtn}
              >
                <Square className={styles.micIcon} />
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={resumeRecording}
                className={styles.roundBtn}
              >
                <Play className={styles.micIcon} />
              </Button>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="icon"
                className={styles.stopBtn}
              >
                <Square className={styles.micIcon} />
              </Button>
            </>
          )}
        </div>

        {/* Tip */}
        {status === 'idle' && (
          <p className={styles.tip}>
            Click &quot;Start Recording&quot; to begin. Your microphone will be used to capture audio directly.
          </p>
        )}
        {isActive && (
          <p className={styles.tip}>
            {isRecording ? 'Recording in progress...' : 'Recording paused.'} Click the stop button when you&apos;re done.
          </p>
        )}
      </div>
    </Card>
  );
}
