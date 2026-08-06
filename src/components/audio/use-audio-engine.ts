'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatTimeShort } from '@/lib/format-utils';

export type LoopMode = 'none' | 'all' | 'segment';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Owns the lifecycle of the underlying HTMLAudioElement plus every transport
 * control (play/pause, seek, skip, volume, rate, loop, download, share).
 * Also subscribes to `seekRequest` from the store so any component (focus
 * view, transcript list) can drive seeking without global hacks.
 */
export function useAudioEngine() {
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
  const seekRequest = useAppStore(s => s.seekRequest);

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
  }, [audioUrl, setAudioPlayback, loopMode, playbackRate, volume, isMuted, uploadedFile]);

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

  // Respond to seek commands broadcast through the store (from focus view,
  // transcript list, or anywhere else).
  useEffect(() => {
    if (!seekRequest) return;
    seek(seekRequest.time);
  }, [seekRequest, seek]);

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
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate = PLAYBACK_RATES[(currentIdx + 1) % PLAYBACK_RATES.length];
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

  return {
    audioUrl,
    isPlaying,
    currentTime,
    audioDuration,
    audioRef,
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
  };
}
