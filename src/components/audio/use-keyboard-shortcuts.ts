'use client';

import { useEffect } from 'react';
import type { LoopMode } from './use-audio-engine';

interface UseKeyboardShortcutsOptions {
  togglePlay: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  toggleMute: () => void;
  cycleLoopMode: () => void;
  cyclePlaybackRate: () => void;
  seek: (time: number) => void;
  volume: number;
  handleVolumeChange: (value: number[]) => void;
  nextSegment: () => void;
  previousSegment: () => void;
  onToggleExpanded: () => void;
  onToggleShortcuts: () => void;
}

/**
 * Global keyboard controls for the player. Ignores key presses while the user
 * is typing in an input or textarea.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
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
    onToggleExpanded,
    onToggleShortcuts,
  } = options;

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
          onToggleExpanded();
          break;
        case '0':
          e.preventDefault();
          seek(0);
          break;
        case '?':
          e.preventDefault();
          onToggleShortcuts();
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
    previousSegment,
    onToggleExpanded,
    onToggleShortcuts,
  ]);
}
