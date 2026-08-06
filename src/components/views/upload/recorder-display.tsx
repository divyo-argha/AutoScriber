import type { CSSProperties } from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { SoundWaveIndicator } from './sound-wave-indicator';
import type { RecorderStatus } from './use-media-recorder';
import styles from './audio-recorder.module.css';

export function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface RecorderDisplayProps {
  status: RecorderStatus;
  duration: number;
  audioLevel: number;
  waveform: number[];
  error: string | null;
  isActive: boolean;
  isRecording: boolean;
  isPaused: boolean;
}

export function RecorderDisplay({ status, duration, audioLevel, waveform, error, isActive, isRecording, isPaused }: RecorderDisplayProps) {
  return (
    <>
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

      <div className={styles.timerCenter}>
        <span className={styles.timer}>
          {formatTimer(duration)}
        </span>
      </div>

      {isActive && (
        <div className={styles.levelRow}>
          <Mic className={styles.levelIcon} />
          <SoundWaveIndicator audioLevel={audioLevel} isActive={isActive} />
          <span className={styles.levelText}>{Math.round(audioLevel * 100)}%</span>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
