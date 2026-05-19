'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime } from '@/lib/format-utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioPlayerProps {
  segments: TranscriptionSegment[];
  speakerColors: Record<string, string>;
}

export function AudioPlayer({ segments, speakerColors }: AudioPlayerProps) {
  const {
    uploadedFile,
    jobId,
    audioUrl,
    isPlaying,
    currentTime,
    audioDuration,
    activeSegmentIndex,
    setAudioPlayback,
  } = useAppStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);
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
      audioUrlCreated.current = null; // Server URLs don't need revoking
      setAudioPlayback({ audioUrl: url });
    }
  }, [uploadedFile, jobId, audioUrl, setAudioPlayback]);

  // Clean up object URLs on unmount (only for blob URLs we created)
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

    audio.addEventListener('loadedmetadata', () => {
      setAudioPlayback({ audioDuration: audio.duration });
    });

    audio.addEventListener('timeupdate', () => {
      const time = audio.currentTime;
      setAudioPlayback({ currentTime: time });

      // Find active segment
      const activeIdx = segments.findIndex(
        seg => time >= seg.startTime && time <= seg.endTime
      );
      if (activeIdx !== -1 && activeIdx !== activeSegmentIndex) {
        setAudioPlayback({ activeSegmentIndex: activeIdx });
      }
    });

    audio.addEventListener('ended', () => {
      setAudioPlayback({ isPlaying: false, activeSegmentIndex: -1 });
    });

    audio.addEventListener('pause', () => {
      setAudioPlayback({ isPlaying: false });
    });

    audio.addEventListener('play', () => {
      setAudioPlayback({ isPlaying: true });
    });

    // Handle errors for server-served audio
    audio.addEventListener('error', () => {
      console.error('[AudioPlayer] Error loading audio from:', audioUrl);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.removeEventListener('loadedmetadata', () => {});
        audioRef.current.removeEventListener('timeupdate', () => {});
        audioRef.current.removeEventListener('ended', () => {});
        audioRef.current.removeEventListener('pause', () => {});
        audioRef.current.removeEventListener('play', () => {});
        audioRef.current.removeEventListener('error', () => {});
      }
      audioRef.current = null;
    };
  }, [audioUrl, segments, setAudioPlayback]);
  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && subtitleContainerRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setAudioPlayback({ currentTime: time });
  }, [setAudioPlayback]);

  const handleSliderChange = useCallback((value: number[]) => {
    seek(value[0]);
  }, [seek]);

  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    seek(Math.min(audioRef.current.currentTime + 5, audioDuration));
  }, [audioDuration, seek]);
  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    seek(Math.max(audioRef.current.currentTime - 5, 0));
  }, [seek]);
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);
  const handleVolumeChange = useCallback((value: number[]) => {
    if (!audioRef.current) return;
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
  const jumpToSegment = useCallback((index: number) => {
    if (segments[index]) {
      seek(segments[index].startTime);
    }
  }, [segments, seek]);

  if (!audioUrl) return null;

  const activeSegment = segments[activeSegmentIndex];

  return (
    <div className="space-y-4">
      {/* Subtitle Display - Current segment prominently shown */}
      <div className="relative bg-gradient-to-b from-card to-card/80 rounded-xl border border-border overflow-hidden">
        {/* Background gradient glow for active segment */}
        <div className="absolute inset-0 opacity-5 bg-emerald-500" />
        <div ref={subtitleContainerRef} className="relative p-4 sm:p-6 min-h-[120px] flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {activeSegment ? (
              <motion.div
                key={activeSegmentIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-2"
              >
                <Badge
                  className={`${speakerColors[activeSegment.speaker] || 'bg-muted text-muted-foreground'} border-0 text-xs`}
                >
                  {activeSegment.speaker}
                </Badge>
                <p className="text-xl sm:text-2xl font-medium leading-relaxed max-w-2xl">
                  {activeSegment.text}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatTime(activeSegment.startTime)} — {formatTime(activeSegment.endTime)}
                </p>
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-muted-foreground text-sm"
              >
                Press play to start audio playback with subtitles
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Audio Controls */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              min={0}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              className="flex-1 cursor-pointer"
            />
            <span className="text-xs font-mono text-muted-foreground w-12">
              {formatTime(audioDuration)}
            </span>
          </div>
          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="h-9 w-9"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              onClick={togglePlay}
              className="h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
              size="icon"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="h-9 w-9"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1 ml-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
                className="w-20 cursor-pointer"
              />
            </div>
            {/* Playback Speed */}
            <Button
              variant="outline"
              size="sm"
              onClick={cyclePlaybackRate}
              className="ml-2 text-xs font-mono min-w-[3rem]"
            >
              {playbackRate}x
            </Button>
          </div>
        </div>
      </Card>
      {/* Scrollable Transcript with Sync Highlighting */}
      <Card className="overflow-hidden">
        <div className="max-h-[40vh] overflow-y-auto scroll-smooth" ref={subtitleContainerRef}>
          <div className="p-3 sm:p-4 space-y-0.5">
            {segments.map((segment, idx) => {
              const isActive = idx === activeSegmentIndex;
              const isPast = currentTime > segment.endTime;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeSegmentRef : undefined}
                  onClick={() => jumpToSegment(idx)}
                  className={`group flex gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all duration-300 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                      : isPast
                      ? 'opacity-50 hover:opacity-80'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="shrink-0 w-20 pt-0.5">
                    <span className={`text-xs font-mono ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                      {formatTime(segment.startTime)}
                    </span>
                  </div>
                  {/* Speaker */}
                  <div className="shrink-0 w-20">
                    <Badge
                      className={`${speakerColors[segment.speaker] || 'bg-muted text-muted-foreground'} border-0 text-[10px] px-1.5 py-0 truncate max-w-full transition-all duration-300 ${
                        isActive ? 'ring-1 ring-current/20' : ''
                      }`}
                    >
                      {segment.speaker}
                    </Badge>
                  </div>
                  {/* Text - highlighted when active */}
                  <div className="flex-1 min-w-0">
                    <motion.p
                      animate={{
                        fontWeight: isActive ? 600 : 400,
                        scale: isActive ? 1.01 : 1,
                      }}
                      transition={{ duration: 0.2 }}
                      className={`text-sm leading-relaxed transition-colors duration-300 ${
                        isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                      }`}
                    >
                      {isActive ? (
                        <span dangerouslySetInnerHTML={{
                          __html: highlightProgress(segment.text, currentTime, segment.startTime, segment.endTime)
                        }} />
                      ) : (
                        segment.text
                      )}
                    </motion.p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Highlights the portion of text that has been "spoken" based on playback progress
 */
function highlightProgress(text: string, currentTime: number, startTime: number, endTime: number): string {
  if (endTime <= startTime) return escapeHtml(text);

  const progress = Math.max(0, Math.min(1, (currentTime - startTime) / (endTime - startTime)));
  const charIndex = Math.floor(progress * text.length);

  if (charIndex <= 0) return `<span class="text-muted-foreground">${escapeHtml(text)}</span>`;
  if (charIndex >= text.length) return `<span class="text-emerald-700 dark:text-emerald-300 font-semibold">${escapeHtml(text)}</span>`;

  const spoken = text.slice(0, charIndex);
  const remaining = text.slice(charIndex);

  return `<span class="text-emerald-700 dark:text-emerald-300 font-semibold">${escapeHtml(spoken)}</span><span class="text-muted-foreground">${escapeHtml(remaining)}</span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
