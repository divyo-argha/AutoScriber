'use client';

import { Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';
import type { LoopMode } from './use-audio-engine';
import styles from './audio-player.module.css';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  loopMode: LoopMode;
  skipInterval: number;
  hasSegments: boolean;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onPreviousSegment: () => void;
  onNextSegment: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number[]) => void;
  onCyclePlaybackRate: () => void;
  onCycleLoopMode: () => void;
}

export function PlayerControls({
  isPlaying,
  isMuted,
  volume,
  playbackRate,
  loopMode,
  skipInterval,
  hasSegments,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onPreviousSegment,
  onNextSegment,
  onToggleMute,
  onVolumeChange,
  onCyclePlaybackRate,
  onCycleLoopMode,
}: PlayerControlsProps) {
  const loopIcon = loopMode === 'segment' ? <Repeat1 className={styles.loopIcon} /> : <Repeat className={styles.loopIcon} />;
  const loopColor = loopMode === 'none' ? '' : styles.loopActive;

  return (
    <div className={styles.controlsRow}>
      {/* Left Block: Speed & Loop */}
      <div className={styles.controlsLeft}>
        <Button
          variant="outline"
          size="sm"
          onClick={onCyclePlaybackRate}
          className={styles.speedBtn}
          title="Playback speed (S)"
        >
          {playbackRate}x
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCycleLoopMode}
          className={`${styles.loopBtn} ${loopColor}`}
          title={`Loop: ${loopMode} (L)`}
        >
          {loopIcon}
        </Button>
      </div>

      {/* Center Block: Playback controls */}
      <div className={styles.controlsCenter}>
        {hasSegments && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousSegment}
            className={styles.ctrlBtn}
            title="Previous segment (Shift+←)"
          >
            <SkipBack className={styles.ctrlIconFill} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipBackward}
          className={styles.ctrlBtn}
          title={`Skip back ${skipInterval}s (←)`}
        >
          <SkipBack className={styles.ctrlIcon} />
        </Button>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button onClick={onTogglePlay} className={styles.playBtn} size="icon" title="Play/Pause (Space or K)">
            {isPlaying ? (
              <Pause className={styles.playIcon} />
            ) : (
              <Play className={styles.playIconOffset} />
            )}
          </Button>
        </motion.div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipForward}
          className={styles.ctrlBtn}
          title={`Skip forward ${skipInterval}s (→)`}
        >
          <SkipForward className={styles.ctrlIcon} />
        </Button>

        {hasSegments && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextSegment}
            className={styles.ctrlBtn}
            title="Next segment (Shift+→)"
          >
            <SkipForward className={styles.ctrlIconFill} />
          </Button>
        )}
      </div>

      {/* Right Block: Volume slider wrapped in pill */}
      <div className={styles.controlsRight}>
        <div className={styles.volumePill}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className={styles.volumeBtn}
            title="Mute (M)"
          >
            {isMuted || volume === 0 ? <VolumeX className={styles.volumeIcon} /> : <Volume2 className={styles.volumeIcon} />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.02}
            onValueChange={onVolumeChange}
            className={styles.volumeSlider}
            title="Volume (↑/↓)"
          />
        </div>
      </div>
    </div>
  );
}
