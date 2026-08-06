import type { StateCreator } from 'zustand';
import type { AppState } from '../types';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';

export interface ModelSlice {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: AppState['availableModels'];
  disabledModels: Record<string, string>;
  setDisabledModel: (modelId: string, reason: string | null) => void;
  clearDisabledModels: () => void;
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = set => ({
  selectedModel: 'gemini-2.0-flash',
  availableModels: AVAILABLE_MODELS,
  disabledModels: {},

  setSelectedModel: model => set({ selectedModel: model }),

  setDisabledModel: (modelId, reason) => set(prev => {
    const next = { ...prev.disabledModels };
    if (reason) {
      next[modelId] = reason;
    } else {
      delete next[modelId];
    }
    return { disabledModels: next };
  }),

  clearDisabledModels: () => set({ disabledModels: {} }),
});
