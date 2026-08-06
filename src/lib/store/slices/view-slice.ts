import type { StateCreator } from 'zustand';
import type { AppState } from '../types';

export interface ViewSlice {
  currentView: AppState['currentView'];
  setCurrentView: (view: AppState['currentView']) => void;
}

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = set => ({
  currentView: 'upload',
  setCurrentView: view => set({ currentView: view }),
});
