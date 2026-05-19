'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { TranscriptionSegment } from '@/lib/transcriber/types';
import { formatTime } from '@/lib/format-utils';
import { calculateWordTimings } from '@/lib/word-timing';

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
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const audioUrlCreated = useRef<string | null>(null);

  // Get active segment
  const activeSegment = segments[activeSegmentIndex];

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
      // Fallback: try to load from blob if available
      if (uploadedFile && !audioUrlCreated.current) {
        const blobUrl = URL.createObjectURL(uploadedFile);
        audioUrlCreated.current = blobUrl;
        audio.src = blobUrl;
      }
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
    if (activeSegmentRef.current && listContainerRef.current) {
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

  if (!audioUrl) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No audio available for playback</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No transcription segments available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Audio Controls */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Seek Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground shrink-0 w-[70px] text-left">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              min={0}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              className="flex-1 cursor-pointer [&_[data-slot=slider-track]]:bg-muted [&_[data-slot=slider-range]]:bg-emerald-600 [&_[data-slot=slider-thumb]]:border-emerald-600 [&_[data-slot=slider-thumb]]:bg-white dark:[&_[data-slot=slider-thumb]]:bg-background"
            />
            <span className="text-xs font-mono text-muted-foreground shrink-0 w-[70px] text-right">
              {formatTime(audioDuration)}
            </span>
          </div>
          
          {/* Control Buttons - Centered with Volume on Right */}
          <div className="flex items-center justify-between gap-2">
            {/* Left spacer for balance */}
            <div className="flex-1 hidden sm:block" />
            
            {/* Center: Playback Controls */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={cyclePlaybackRate}
                className="text-xs font-mono min-w-[3rem] h-8"
              >
                {playbackRate}x
              </Button>
            </div>
            
            {/* Right: Volume Controls */}
            <div className="flex-1 flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8 hidden sm:flex"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
                className="w-20 cursor-pointer hidden sm:block [&_[data-slot=slider-track]]:bg-muted [&_[data-slot=slider-range]]:bg-emerald-600 [&_[data-slot=slider-thumb]]:border-emerald-600"
              />
            </div>
          </div>
        </div>
      </Card>
      {/* Scrollable Transcript with Word-by-Word Sync Highlighting */}
      <Card className="overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto scroll-smooth" ref={listContainerRef}>
          <div className="p-3 sm:p-4 space-y-1">
            {segments.map((segment, idx) => {
              const isActive = idx === activeSegmentIndex;
              const isPast = currentTime > segment.endTime;
              
              // Calculate word timings for this segment
              const segmentWordTimings = calculateWordTimings(segment.text, segment.startTime, segment.endTime);
              
              return (
                <div
                  key={idx}
                  ref={isActive ? activeSegmentRef : undefined}
                  onClick={() => jumpToSegment(idx)}
                  className={`group flex gap-2 sm:gap-3 py-2.5 px-2 sm:px-3 rounded-lg cursor-pointer transition-all duration-300 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30'
                      : isPast
                      ? 'opacity-50 hover:opacity-80'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="shrink-0 w-[52px] pt-0.5">
                    <span className={`text-[11px] font-mono leading-tight block ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                      {formatTime(segment.startTime)}
                    </span>
                  </div>
                  
                  {/* Speaker */}
                  <div className="shrink-0 w-[68px] sm:w-[76px]">
                    <Badge
                      className={`${speakerColors[segment.speaker] || 'bg-muted text-muted-foreground'} border-0 text-[10px] px-1.5 py-0.5 truncate max-w-full transition-all duration-300 ${
                        isActive ? 'ring-1 ring-current/20' : ''
                      }`}
                    >
                      {segment.speaker}
                    </Badge>
                  </div>
                  
                  {/* Text - word-by-word highlighting like Reels */}
                  <div className="flex-1 min-w-0">
                    {isActive ? (
                      <p className="text-sm leading-relaxed" style={{ minHeight: '1.5rem' }}>
                        {segmentWordTimings.map((wordTiming, wordIdx) => {
                          const isCurrentWord = currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime;
                          const isWordPast = currentTime > wordTiming.endTime;
                          
                          return (
                            <span
                              key={wordIdx}
                              className={`inline-block transition-all duration-75 mr-1 ${
                                isCurrentWord
                                  ? 'font-bold text-white dark:text-black bg-emerald-600 dark:bg-emerald-400 px-1 py-0.5 rounded shadow-md'
                                  : isWordPast
                                  ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'text-muted-foreground font-normal'
                              }`}
                              style={{
                                // Reserve space to prevent layout shift
                                fontWeight: isCurrentWord || isWordPast ? 600 : 400,
                              }}
                            >
                              {wordTiming.word}
                            </span>
                          );
                        })}
                      </p>
                    ) : (
                      <p className={`text-sm leading-relaxed ${isPast ? 'text-muted-foreground' : ''}`} style={{ minHeight: '1.5rem' }}>
                        {segment.text}
                      </p>
                    )}
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
