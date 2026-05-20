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
  const loopSegmentRef = useRef<{ start: number; end: number } | null>(null);

  // Create audio URL from uploaded file or from server (history)
  useEffect(() => {
    if (audioUrl) return; // Already have a URL

    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      audioUrlCreated.current = url;
      setAudioPlayback({ audioUrl: url });
    } else if (jobId) {
      // Load from server via API (for history playback)
      const url = `/api/audio?jobId=${jobId}`;
      audioUrlCreated.current = null;
      setAudioPlayback({ audioUrl: url });
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
      if (transcriptionSegments && transcriptionSegments.length > 0) {
        const activeIdx = transcriptionSegments.findIndex(
          seg => time >= seg.startTime && time <= seg.endTime
        );
        if (activeIdx !== -1) {
          setAudioPlayback({ activeSegmentIndex: activeIdx });
          
          // Update loop segment reference if in segment loop mode
          if (loopMode === 'segment') {
            const seg = transcriptionSegments[activeIdx];
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
  }, [audioUrl, transcriptionSegments, setAudioPlayback, loopMode]);

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

  const loopIcon = loopMode === 'segment' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />;
  const loopColor = loopMode === 'none' 
    ? 'text-muted-foreground' 
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br from-card/90 via-card/80 to-card/50 dark:from-zinc-900/90 dark:to-zinc-950/60 border border-emerald-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] backdrop-blur-md rounded-2xl transition-all duration-300 ${isExpanded ? 'p-8 sm:p-10' : 'p-5 sm:p-6'}`}>
        {/* Decorative ambient gradient background inside player card */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Buffering indicator */}
        <AnimatePresence>
          {isBuffering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 right-4 z-20"
            >
              <div className="flex items-center gap-2 bg-emerald-500/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Loading...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative space-y-4">
          {/* Top Controls Bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Badge variant="outline" className="text-xs font-mono">
                  {transcriptionSegments.length} segments
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={shareTimestamp}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                title="Share timestamp"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={downloadAudio}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                title="Download audio"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(prev => !prev)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                title="Toggle expanded view (F)"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(prev => !prev)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
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
                className="overflow-hidden"
              >
                <Card className="p-4 bg-secondary/30 border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Skip Interval</span>
                    <div className="flex gap-2">
                      {[5, 10, 15, 30].map(interval => (
                        <Button
                          key={interval}
                          variant={skipInterval === interval ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSkipInterval(interval)}
                          className="h-7 px-2 text-xs"
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
          <div className="space-y-1.5">
            <Slider
              value={[currentTime]}
              min={0}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              className="cursor-pointer py-1"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground/80 px-0.5">
              <span className="bg-muted/40 px-1.5 py-0.5 rounded text-foreground/80">{formatTimeShort(currentTime)}</span>
              <span className="bg-muted/40 px-1.5 py-0.5 rounded text-foreground/80">
                {audioDuration && isFinite(audioDuration) && audioDuration > 0
                  ? `-${formatTimeShort(Math.max(0, audioDuration - currentTime))}`
                  : '00:00'}
              </span>
            </div>
          </div>

          {/* Controls Layout */}
          <div className="flex items-center justify-between gap-4 pt-1">
            
            {/* Left Block: Speed & Loop */}
            <div className="flex-1 flex justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cyclePlaybackRate}
                className="text-xs font-mono font-medium h-8 px-2.5 rounded-full border-border/50 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all duration-200"
                title="Playback speed (S)"
              >
                {playbackRate}x
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleLoopMode}
                className={`h-8 w-8 rounded-full hover:bg-secondary/50 active:scale-90 transition-all ${loopColor}`}
                title={`Loop: ${loopMode} (L)`}
              >
                {loopIcon}
              </Button>
            </div>

            {/* Center Block: Playback controls */}
            <div className="flex items-center justify-center gap-3">
              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={previousSegment}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-90 transition-all"
                  title="Previous segment (Shift+←)"
                >
                  <SkipBack className="w-4.5 h-4.5 fill-current" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={skipBackward}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-90 transition-all"
                title={`Skip back ${skipInterval}s (←)`}
              >
                <SkipBack className="w-4.5 h-4.5" />
              </Button>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={togglePlay}
                  className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/10 hover:shadow-emerald-500/35 transition-all border border-emerald-400/20"
                  size="icon"
                  title="Play/Pause (Space or K)"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-white ml-1" />
                  )}
                </Button>
              </motion.div>

              <Button
                variant="ghost"
                size="icon"
                onClick={skipForward}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-90 transition-all"
                title={`Skip forward ${skipInterval}s (→)`}
              >
                <SkipForward className="w-4.5 h-4.5" />
              </Button>

              {transcriptionSegments && transcriptionSegments.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextSegment}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-90 transition-all"
                  title="Next segment (Shift+→)"
                >
                  <SkipForward className="w-4.5 h-4.5 fill-current" />
                </Button>
              )}
            </div>

            {/* Right Block: Volume slider wrapped in pill */}
            <div className="flex-1 flex justify-end">
              <div className="hidden sm:flex items-center gap-2 bg-secondary/35 hover:bg-secondary/60 transition-all px-3 py-1.5 rounded-full border border-border/40 backdrop-blur-sm group">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-5 w-5 hover:bg-transparent text-muted-foreground group-hover:text-foreground hover:text-foreground p-0"
                  title="Mute (M)"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.02}
                  onValueChange={handleVolumeChange}
                  className="w-16 sm:w-20 cursor-pointer"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Keyboard className="w-5 h-5" />
                  Keyboard Shortcuts
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Play/Pause</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Space</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Skip Forward/Back</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">←</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">→</kbd>
                  </div>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Previous/Next Segment</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Shift+←</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Shift+→</kbd>
                  </div>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Volume Up/Down</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↑</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↓</kbd>
                  </div>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Mute</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">M</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Cycle Loop Mode</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">L</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Cycle Speed</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">S</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Toggle Expanded</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Restart</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">0</kbd>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Show Shortcuts</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
