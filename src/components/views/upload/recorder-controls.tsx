import { Button } from '@/components/ui/button';
import { Mic, Pause, Play, Square } from 'lucide-react';
import type { RecorderStatus } from './use-media-recorder';
import styles from './audio-recorder.module.css';

interface RecorderControlsProps {
  status: RecorderStatus;
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export function RecorderControls({ status, isRecording, isPaused, onStart, onPause, onResume, onStop, onCancel }: RecorderControlsProps) {
  return (
    <div className={styles.controls}>
      {status === 'idle' && (
        <>
          <Button onClick={onStart} className={styles.recordBtn}>
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
          <Button variant="outline" size="icon" onClick={onPause} className={styles.roundBtn}>
            <Pause className={styles.micIcon} />
          </Button>
          <Button onClick={onStop} variant="destructive" size="icon" className={styles.stopBtn}>
            <Square className={styles.micIcon} />
          </Button>
        </>
      )}

      {isPaused && (
        <>
          <Button variant="outline" size="icon" onClick={onResume} className={styles.roundBtn}>
            <Play className={styles.micIcon} />
          </Button>
          <Button onClick={onStop} variant="destructive" size="icon" className={styles.stopBtn}>
            <Square className={styles.micIcon} />
          </Button>
        </>
      )}
    </div>
  );
}
