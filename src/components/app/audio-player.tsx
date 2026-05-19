'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { formatTimeShort } from '@/lib/format-utils';
import { motion } from 'framer-motion';

export function AudioPlayer() {
  const {
    uploadedFile,
    jobId,
    audioUrl,
    isPlaying,
    currentTime,
    audioDuration,
    activeSegmentIndex,
    setAudioPlayback,
    transcriptionSegments,
  } = useAppStore();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioUrlCreated = useRef<string | null>(null);

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
        }
      }
    };

    const handleEnded = () => {
      setAudioPlayback({ isPlaying: false, activeSegmentIndex: -1 });
    };

    const handlePause = () => {
      setAudioPlayback({ isPlaying: false });
    };

    const handlePlay = () => {
      setAudioPlayback({ isPlaying: true });
    };

    const handleError = () => {
      console.error('[AudioPlayer] Error loading audio from:', audioUrl);
      if (uploadedFile && !audioUrlCreated.current) {
        const blobUrl = URL.createObjectURL(uploadedFile);
        audioUrlCreated.current = blobUrl;
        audio.src = blobUrl;
      }
    };

    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('canplay', updateDuration);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);

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
      }
      audioRef.current = null;
    };
  }, [audioUrl, transcriptionSegments, setAudioPlayback]);

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
    seek(Math.min(curr + 5, dur));
  }, [audioDuration, seek]);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    seek(Math.max(curr - 5, 0));
  }, [seek]);

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

  if (!audioUrl) return null;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/80 to-card/50 dark:from-zinc-900/90 dark:to-zinc-950/60 border border-emerald-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] backdrop-blur-md rounded-2xl p-5 sm:p-6 transition-all duration-300">
      {/* Decorative ambient gradient background inside player card */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-4">
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
          
          {/* Left Block: Speed Selector */}
          <div className="flex-1 flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={cyclePlaybackRate}
              className="text-xs font-mono font-medium h-8 px-2.5 rounded-full border-border/50 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 hover:border-emerald-500/20 active:scale-95 transition-all duration-200"
            >
              {playbackRate}x
            </Button>
          </div>

          {/* Center Block: Playback controls */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-90 transition-all"
              title="Skip back 5s"
            >
              <SkipBack className="w-4.5 h-4.5" />
            </Button>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={togglePlay}
                className="h-14 w-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/10 hover:shadow-emerald-500/35 transition-all border border-emerald-400/20"
                size="icon"
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
              title="Skip forward 5s"
            >
              <SkipForward className="w-4.5 h-4.5" />
            </Button>
          </div>

          {/* Right Block: Volume slider wrapped in pill */}
          <div className="flex-1 flex justify-end">
            <div className="hidden sm:flex items-center gap-2 bg-secondary/35 hover:bg-secondary/60 transition-all px-3 py-1.5 rounded-full border border-border/40 backdrop-blur-sm group">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-5 w-5 hover:bg-transparent text-muted-foreground group-hover:text-foreground hover:text-foreground p-0"
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
              />
            </div>
          </div>

        </div>
      </div>
    </Card>
  );
}
