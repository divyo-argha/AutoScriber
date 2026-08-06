'use client';

import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { formatTimeShort } from '@/lib/format-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioEngine } from './use-audio-engine';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { PlayerTopBar } from './player-top-bar';
import { PlayerControls } from './player-controls';
import { PlayerSettingsPanel } from './player-settings-panel';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import styles from './audio-player.module.css';

export function AudioPlayer() {
  const { transcriptionSegments } = useAppStore();
  const {
    audioUrl,
    isPlaying,
    currentTime,
    audioDuration,
    volume,
    isMuted,
    playbackRate,
    loopMode,
    isExpanded,
    setIsExpanded,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showSettings,
    setShowSettings,
    skipInterval,
    setSkipInterval,
    isBuffering,
    togglePlay,
    seek,
    handleSliderChange,
    skipForward,
    skipBackward,
    toggleMute,
    handleVolumeChange,
    cyclePlaybackRate,
    cycleLoopMode,
    downloadAudio,
    shareTimestamp,
    nextSegment,
    previousSegment,
  } = useAudioEngine();

  useKeyboardShortcuts({
    togglePlay,
    skipBackward,
    skipForward,
    toggleMute,
    cycleLoopMode,
    cyclePlaybackRate,
    seek,
    volume,
    handleVolumeChange,
    nextSegment,
    previousSegment,
    onToggleExpanded: () => setIsExpanded(prev => !prev),
    onToggleShortcuts: () => setShowKeyboardShortcuts(prev => !prev),
  });

  if (!audioUrl) return null;

  return (
    <>
      <Card className={`${styles.playerCard} ${isExpanded ? styles.playerCardExpanded : styles.playerCardCompact}`}>
        {/* Decorative ambient gradient background inside player card */}
        <div className={styles.ambientBlobTop} />
        <div className={styles.ambientBlobBottom} />

        {/* Buffering indicator */}
        <AnimatePresence>
          {isBuffering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.bufferingWrap}
            >
              <div className={styles.bufferingBadge}>
                <div className={styles.bufferingDot} />
                <span className={styles.bufferingText}>Loading...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.mainContent}>
          {/* Top Controls Bar */}
          <PlayerTopBar
            segmentsCount={transcriptionSegments.length}
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded(prev => !prev)}
            onToggleShortcuts={() => setShowKeyboardShortcuts(true)}
            onToggleSettings={() => setShowSettings(prev => !prev)}
            onShare={shareTimestamp}
            onDownload={downloadAudio}
          />

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <PlayerSettingsPanel
                skipInterval={skipInterval}
                onSkipIntervalChange={setSkipInterval}
              />
            )}
          </AnimatePresence>

          {/* Progress Bar Container */}
          <div className={styles.progressWrap}>
            <Slider
              value={[currentTime]}
              min={0}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              className={styles.sliderTrack}
            />
            <div className={styles.timeRow}>
              <span className={styles.timeChip}>{formatTimeShort(currentTime)}</span>
              <span className={styles.timeChip}>
                {audioDuration && isFinite(audioDuration) && audioDuration > 0
                  ? `-${formatTimeShort(Math.max(0, audioDuration - currentTime))}`
                  : '00:00'}
              </span>
            </div>
          </div>

          {/* Controls Layout */}
          <PlayerControls
            isPlaying={isPlaying}
            isMuted={isMuted}
            volume={volume}
            playbackRate={playbackRate}
            loopMode={loopMode}
            skipInterval={skipInterval}
            hasSegments={transcriptionSegments.length > 0}
            onTogglePlay={togglePlay}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onPreviousSegment={previousSegment}
            onNextSegment={nextSegment}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onCyclePlaybackRate={cyclePlaybackRate}
            onCycleLoopMode={cycleLoopMode}
          />
        </div>
      </Card>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <KeyboardShortcutsModal
            open={showKeyboardShortcuts}
            onClose={() => setShowKeyboardShortcuts(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
