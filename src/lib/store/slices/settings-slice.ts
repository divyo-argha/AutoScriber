import type { StateCreator } from 'zustand';
import type { AppState, SettingsState } from '../types';

export interface SettingsSlice {
  geminiApiKey: string;
  chunkDuration: number;
  overlapDuration: number;
  userGeminiApiKey: string;
  hasVertexKey: boolean;
  setSettings: (settings: Partial<SettingsState>) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = set => ({
  geminiApiKey: '',
  chunkDuration: 300,
  overlapDuration: 30,
  userGeminiApiKey: '',
  hasVertexKey: false,

  setSettings: settings => set(prev => ({ ...prev, ...settings })),
});
