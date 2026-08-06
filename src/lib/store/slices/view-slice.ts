import type { StateCreator } from 'zustand';
import type { AppState } from '../types';

/**
 * Tracks which sub-view the Studio page (`/`) shows: upload → processing →
 * result. History, Batch and Settings are top-level routes now, not views.
 */
export interface ViewSlice {
  currentView: AppState['currentView'];
  setCurrentView: (view: AppState['currentView']) => void;
}

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = set => ({
  currentView: 'upload',
  setCurrentView: view => set({ currentView: view }),
});
