'use client';

import { Card } from '@/components/ui/card';
import { useMediaRecorder } from './use-media-recorder';
import { RecorderDisplay } from './recorder-display';
import { RecorderControls } from './recorder-controls';
import styles from './audio-recorder.module.css';

interface AudioRecorderProps {
  onRecordingComplete: (file: File, blob: Blob) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const {
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
  } = useMediaRecorder(onRecordingComplete);

  return (
    <Card className={styles.container}>
      <div className={styles.inner}>
        <RecorderDisplay
          status={status}
          duration={duration}
          audioLevel={audioLevel}
          waveform={waveform}
          error={error}
          isActive={isActive}
          isRecording={isRecording}
          isPaused={isPaused}
        />

        <RecorderControls
          status={status}
          isRecording={isRecording}
          isPaused={isPaused}
          onStart={startRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onCancel={onCancel}
        />

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
