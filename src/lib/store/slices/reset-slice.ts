import type { StateCreator } from 'zustand';
import type { AppState } from '../types';
import { createInitialState } from '../initial';

export interface ResetSlice {
  reset: () => void;
}

export const createResetSlice: StateCreator<AppState, [], [], ResetSlice> = (set, get) => ({
  reset: () => set(prev => {
    // Revoke old audio URL to prevent memory leak
    if (prev.audioUrl && !prev.audioUrl.startsWith('/api/')) {
      try { URL.revokeObjectURL(prev.audioUrl); } catch {}
    }
    return {
      ...createInitialState(),
      // Preserve settings, history, and model selection across resets
      geminiApiKey: prev.geminiApiKey,
      chunkDuration: prev.chunkDuration,
      overlapDuration: prev.overlapDuration,
      userGeminiApiKey: prev.userGeminiApiKey,
      historyJobs: prev.historyJobs,
      selectedModel: prev.selectedModel,
    };
  }),
});
