'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Pause, Play, Square, AlertCircle } from 'lucide-react';

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
  
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      
      streamRef.current = stream;
      
      // Set up audio analyser for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setStatus('recording');
      setDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Start audio level monitoring
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(avg / 255);
          
          // Update waveform data (shift left, add new value)
          setWaveform(prev => [...prev.slice(1), avg / 255]);
        }
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      
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
  }, []);
  
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [status]);
  
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Resume audio level monitoring
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
    }
  }, [status]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setStatus('stopped');
      
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      setAudioLevel(0);
      
      // Create file from recorded chunks
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
      const file = new File([blob], `recording_${Date.now()}.${ext}`, { type: mimeType });
      
      onRecordingComplete(file, blob);
    }
  }, [onRecordingComplete]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
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
          <div className="flex items-center gap-2 justify-center">
            <Mic className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75 bg-emerald-500"
                style={{ width: `${Math.max(2, audioLevel * 100)}%` }}
              />
            </div>
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
