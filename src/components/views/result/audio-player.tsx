'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Repeat,
  Repeat1,
  Download,
  Share2,
  Maximize2,
  Minimize2,
  Settings,
  Keyboard
} from 'lucide-react';
import { formatTimeShort } from '@/lib/format-utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './audio-player.module.css';

type LoopMode = 'none' | 'all' | 'segment';

export function AudioPlayer() {
  const {
    uploadedFile,
    jobId,
    audioUrl,
    isPlaying,
    currentTime,
    audioDuration,
    setAudioPlayback,
    transcriptionSegments,
  } = useAppStore();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [skipInterval, setSkipInterval] = useState(5);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioUrlCreated = useRef<string | null>(null);
  const audioSourceRef = useRef<string | null>(null);
  const loopSegmentRef = useRef<{ start: number; end: number } | null>(null);
  const segmentsRef = useRef(transcriptionSegments);

  useEffect(() => {
    segmentsRef.current = transcriptionSegments;
  }, [transcriptionSegments]);

  // Create audio URL from uploaded file or from server (history).
  // Rebuilds the URL whenever the underlying source (uploaded file or history
  // job) actually changes; previously a stale audioUrl from a prior job made
  // the player keep playing the wrong file.
  useEffect(() => {
    const sourceKey = uploadedFile
      ? `upload:${uploadedFile.name}:${uploadedFile.size}:${uploadedFile.lastModified}`
      : jobId
        ? `job:${jobId}`
        : null;

    if (!sourceKey) return;
    if (audioSourceRef.current === sourceKey) return;

    if (audioUrlCreated.current) {
      try { URL.revokeObjectURL(audioUrlCreated.current); } catch {}
      audioUrlCreated.current = null;
    }

    let nextUrl: string | null = null;
    if (uploadedFile) {
      nextUrl = URL.createObjectURL(uploadedFile);
      audioUrlCreated.current = nextUrl;
    } else if (jobId) {
      nextUrl = `/api/audio?jobId=${encodeURIComponent(jobId)}`;
    }

    audioSourceRef.current = sourceKey;
    if (nextUrl && nextUrl !== audioUrl) {
      setAudioPlayback({ audioUrl: nextUrl, currentTime: 0, isPlaying: false, audioDuration: 0, activeSegmentIndex: -1 });
    }
  }, [uploadedFile, jobId, audioUrl, setAudioPlayback]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrlCreated.current) {
        try { URL.revokeObjectURL(audioUrlCreated.current); } catch {}
      }
    };
  }, []);

  // Set up audio element
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const updateDuration = () => {
      if (audio && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setAudioPlayback({ audioDuration: audio.duration });
      }
    };

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      if (!isFinite(time) || isNaN(time)) return;
      
      setAudioPlayback({ currentTime: time });

      // Find active segment
      const segs = segmentsRef.current;
      if (segs && segs.length > 0) {
        const activeIdx = segs.findIndex(
          seg => time >= seg.startTime && time <= seg.endTime
        );
        if (activeIdx !== -1) {
          if (activeIdx !== useAppStore.getState().activeSegmentIndex) {
            setAudioPlayback({ activeSegmentIndex: activeIdx });
          }
          
          // Update loop segment reference if in segment loop mode
          if (loopMode === 'segment') {
            const seg = segs[activeIdx];
            loopSegmentRef.current = { start: seg.startTime, end: seg.endTime };
          }
        }
      }

      // Handle segment looping
      if (loopMode === 'segment' && loopSegmentRef.current) {
        if (time >= loopSegmentRef.current.end) {
          audio.currentTime = loopSegmentRef.current.start;
        }
      }
    };

    const handleEnded = () => {
      if (loopMode === 'all') {
        audio.currentTime = 0;
        audio.play().catch(err => console.error('[AudioPlayer] loop play failed:', err));
      } else {
        setAudioPlayback({ isPlaying: false, activeSegmentIndex: -1 });
      }
    };

    const handlePause = () => {
      setAudioPlayback({ isPlaying: false });
    };

    const handlePlay = () => {
      setAudioPlayback({ isPlaying: true });
    };

    const handleError = () => {
      console.error('[AudioPlayer] Error loading audio from:', audioUrl);
      setIsBuffering(false);
      if (uploadedFile && !audioUrlCreated.current) {
        const blobUrl = URL.createObjectURL(uploadedFile);
        audioUrlCreated.current = blobUrl;
        audio.src = blobUrl;
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleLoadStart = () => setIsBuffering(true);

    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('canplay', updateDuration);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);

    // Immediate check in case metadata is already cached/loaded
    if (audio.readyState >= 1 && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
      setAudioPlayback({ audioDuration: audio.duration });
    }

    // Sync initial rate and volume
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('durationchange', updateDuration);
        audio.removeEventListener('canplay', updateDuration);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('waiting', handleWaiting);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('loadstart', handleLoadStart);
      }
      audioRef.current = null;
    };
  }, [audioUrl, setAudioPlayback, loopMode]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('[AudioPlayer] play failed:', err);
      });
    }
  }, [isPlaying]);

  // Robust seek function checking for finite double values (Fixes the TypeError)
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    if (typeof time !== 'number' || isNaN(time) || !isFinite(time)) {
      console.warn('[AudioPlayer] seek blocked: non-finite time received:', time);
      return;
    }
    
    // Bounds check
    const duration = audioRef.current.duration || audioDuration || 0;
    const boundedTime = Math.max(0, Math.min(time, duration));
    
    try {
      audioRef.current.currentTime = boundedTime;
      setAudioPlayback({ currentTime: boundedTime });
    } catch (err) {
      console.error('[AudioPlayer] seek failed:', err);
    }
  }, [audioDuration, setAudioPlayback]);

  const handleSliderChange = useCallback((value: number[]) => {
    if (value && value.length > 0) {
      seek(value[0]);
    }
  }, [seek]);

  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    const dur = audioRef.current.duration || audioDuration || 0;
    seek(Math.min(curr + skipInterval, dur));
  }, [audioDuration, seek, skipInterval]);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    seek(Math.max(curr - skipInterval, 0));
  }, [seek, skipInterval]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((value: number[]) => {
    if (!audioRef.current || value.length === 0) return;
    const vol = value[0];
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    if (!audioRef.current) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIdx = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIdx + 1) % rates.length];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const cycleLoopMode = useCallback(() => {
    const modes: LoopMode[] = ['none', 'all', 'segment'];
    const currentIdx = modes.indexOf(loopMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setLoopMode(nextMode);
    
    // Reset loop segment when changing modes
    if (nextMode !== 'segment') {
      loopSegmentRef.current = null;
    }
  }, [loopMode]);

  const downloadAudio = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = uploadedFile?.name || 'audio.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl, uploadedFile]);

  const shareTimestamp = useCallback(() => {
    const timestamp = formatTimeShort(currentTime);
    const text = `Check this out at ${timestamp}`;
    if (navigator.share) {
      navigator.share({ title: 'Audio Timestamp', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
    }
  }, [currentTime]);

  const jumpToSegment = useCallback((segmentIndex: number) => {
    if (!transcriptionSegments || segmentIndex < 0 || segmentIndex >= transcriptionSegments.length) return;
    const segment = transcriptionSegments[segmentIndex];
    seek(segment.startTime);
  }, [transcriptionSegments, seek]);

  const nextSegment = useCallback(() => {
    if (!transcriptionSegments || transcriptionSegments.length === 0) return;
    const currentIdx = transcriptionSegments.findIndex(
      seg => currentTime >= seg.startTime && currentTime <= seg.endTime
    );
    if (currentIdx !== -1 && currentIdx < transcriptionSegments.length - 1) {
      jumpToSegment(currentIdx + 1);
    }
  }, [transcriptionSegments, currentTime, jumpToSegment]);

  const previousSegment = useCallback(() => {
    if (!transcriptionSegments || transcriptionSegments.length === 0) return;
    const currentIdx = transcriptionSegments.findIndex(
      seg => currentTime >= seg.startTime && currentTime <= seg.endTime
    );
    if (currentIdx > 0) {
      jumpToSegment(currentIdx - 1);
    } else if (currentIdx === 0) {
      seek(transcriptionSegments[0].startTime);
    }
  }, [transcriptionSegments, currentTime, jumpToSegment, seek]);

  // Hook global keys or store callbacks for seeking so focus list can use it
  useEffect(() => {
    // Expose a window level helper so list items can trigger seek on the active audio instance
    (window as any).__autoScribeSeek = (time: number) => {
      seek(time);
    };

    return () => {
      delete (window as any).__autoScribeSeek;
    };
  }, [seek]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (e.shiftKey) {
            previousSegment();
          } else {
            skipBackward();
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (e.shiftKey) {
            nextSegment();
          } else {
            skipForward();
          }
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange([Math.min(volume + 0.1, 1)]);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange([Math.max(volume - 0.1, 0)]);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'l':
          e.preventDefault();
          cycleLoopMode();
          break;
        case 's':
          e.preventDefault();
          cyclePlaybackRate();
          break;
        case 'f':
          e.preventDefault();
          setIsExpanded(prev => !prev);
          break;
        case '0':
          e.preventDefault();
          seek(0);
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardShortcuts(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
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
    previousSegment
  ]);

  if (!audioUrl) return null;

const loopIcon = loopMode === 'segment' ? <Repeat1 className={styles.loopIcon} /> : <Repeat className={styles.loopIcon} />;
  const loopColor = loopMode === 'none' ? '' : styles.loopActive;

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
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                className={styles.iconBtn}
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className={styles.iconMd} />
              </Button>
              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Badge variant="outline" className={styles.segmentsBadge}>
                  {transcriptionSegments.length} segments
                </Badge>
              )}
            </div>
            <div className={styles.topBarRight}>
              <Button
                variant="ghost"
                size="icon"
                onClick={shareTimestamp}
                className={styles.iconBtn}
                title="Share timestamp"
              >
                <Share2 className={styles.iconMd} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={downloadAudio}
                className={styles.iconBtn}
                title="Download audio"
              >
                <Download className={styles.iconMd} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(prev => !prev)}
                className={styles.iconBtn}
                title="Toggle expanded view (F)"
              >
                {isExpanded ? <Minimize2 className={styles.iconMd} /> : <Maximize2 className={styles.iconMd} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(prev => !prev)}
                className={styles.iconBtn}
                title="Settings"
              >
                <Settings className={styles.iconMd} />
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={styles.settingsPanel}
              >
                <Card className={styles.settingsCard}>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Skip Interval</span>
                    <div className={styles.skipBtns}>
                      {[5, 10, 15, 30].map(interval => (
                        <Button
                          key={interval}
                          variant={skipInterval === interval ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSkipInterval(interval)}
                          className={styles.skipBtn}
                        >
                          {interval}s
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
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
          <div className={styles.controlsRow}>
            
            {/* Left Block: Speed & Loop */}
            <div className={styles.controlsLeft}>
              <Button
                variant="outline"
                size="sm"
                onClick={cyclePlaybackRate}
                className={styles.speedBtn}
                title="Playback speed (S)"
              >
                {playbackRate}x
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleLoopMode}
                className={`${styles.loopBtn} ${loopColor}`}
                title={`Loop: ${loopMode} (L)`}
              >
                {loopIcon}
              </Button>
            </div>

            {/* Center Block: Playback controls */}
            <div className={styles.controlsCenter}>
              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={previousSegment}
                  className={styles.ctrlBtn}
                  title="Previous segment (Shift+←)"
                >
                  <SkipBack className={styles.ctrlIconFill} />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={skipBackward}
                className={styles.ctrlBtn}
                title={`Skip back ${skipInterval}s (←)`}
              >
                <SkipBack className={styles.ctrlIcon} />
              </Button>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={togglePlay}
                  className={styles.playBtn}
                  size="icon"
                  title="Play/Pause (Space or K)"
                >
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
                onClick={skipForward}
                className={styles.ctrlBtn}
                title={`Skip forward ${skipInterval}s (→)`}
              >
                <SkipForward className={styles.ctrlIcon} />
              </Button>

              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextSegment}
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
                  onClick={toggleMute}
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
                  onValueChange={handleVolumeChange}
                  className={styles.volumeSlider}
                  title="Volume (↑/↓)"
                />
              </div>
            </div>

          </div>
        </div>
      </Card>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.overlay}
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.modalCard}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Keyboard className={styles.modalTitleIcon} />
                  Keyboard Shortcuts
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className={styles.modalCloseBtn}
                >
                  ✕
                </Button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Play/Pause</span>
                  <kbd className={styles.kbd}>Space</kbd>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Skip Forward/Back</span>
                  <div className={styles.shortcutKeys}>
                    <kbd className={styles.kbd}>←</kbd>
                    <kbd className={styles.kbd}>→</kbd>
                  </div>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Previous/Next Segment</span>
                  <div className={styles.shortcutKeys}>
                    <kbd className={styles.kbd}>Shift+←</kbd>
                    <kbd className={styles.kbd}>Shift+→</kbd>
                  </div>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Volume Up/Down</span>
                  <div className={styles.shortcutKeys}>
                    <kbd className={styles.kbd}>↑</kbd>
                    <kbd className={styles.kbd}>↓</kbd>
                  </div>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Mute</span>
                  <kbd className={styles.kbd}>M</kbd>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Cycle Loop Mode</span>
                  <kbd className={styles.kbd}>L</kbd>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Cycle Speed</span>
                  <kbd className={styles.kbd}>S</kbd>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Toggle Expanded</span>
                  <kbd className={styles.kbd}>F</kbd>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutLabel}>Restart</span>
                  <kbd className={styles.kbd}>0</kbd>
                </div>
                <div className={styles.shortcutRowNoBorder}>
                  <span className={styles.shortcutLabel}>Show Shortcuts</span>
                  <kbd className={styles.kbd}>?</kbd>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
