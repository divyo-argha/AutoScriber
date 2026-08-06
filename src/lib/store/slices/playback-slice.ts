import type { StateCreator } from 'zustand';
import type { AppState, PlaybackState } from '../types';

let seekCounter = 0;

export interface PlaybackSlice {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
  seekRequest: AppState['seekRequest'];
  setAudioPlayback: (state: Partial<PlaybackState>) => void;
  seekTo: (time: number) => void;
}

export const createPlaybackSlice: StateCreator<AppState, [], [], PlaybackSlice> = set => ({
  audioUrl: null,
  isPlaying: false,
  currentTime: 0,
  audioDuration: 0,
  activeSegmentIndex: -1,
  seekRequest: null,

  setAudioPlayback: state => set(prev => ({ ...prev, ...state })),

  // Broadcast a seek command to whatever player is mounted. The audio-player
  // effect watches seekRequest and performs the actual seek.
  seekTo: time => set(prev => ({
    seekRequest: { requestId: ++seekCounter, time },
  })),
});
