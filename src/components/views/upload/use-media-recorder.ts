import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Owns the MediaRecorder lifecycle: mic access, analyser-based level
 * monitoring, timing, pause/resume, stop (with final blob capture), and
 * teardown on unmount.
 */
export function useMediaRecorder(onRecordingComplete: (file: File, blob: Blob) => void) {
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

  const stopAnimationLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

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

      mediaRecorder.start(100);
      setStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

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

    stopTimer();
    stopAnimationLoop();
    setAudioLevel(0);
    setStatus('stopped');

    stopStream();

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

      closeAudioContext();

      onRecordingComplete(file, blob);

      chunksRef.current = [];
    };

    try {
      recorder.requestData();
    } catch {
      // Some browsers throw if already stopped
    }
    recorder.stop();
  }, [onRecordingComplete, stopTimer, stopAnimationLoop, stopStream, closeAudioContext, showError]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopAnimationLoop();
      stopStream();
      closeAudioContext();

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

  return {
    status,
    duration,
    error,
    audioLevel,
    waveform,
    isRecording,
    isPaused,
    isActive,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
