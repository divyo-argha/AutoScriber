import type { StateCreator } from 'zustand';
import type { AppState, HistoryJob } from '../types';

export interface HistorySlice {
  historyJobs: HistoryJob[];
  setHistoryJobs: (jobs: HistoryJob[]) => void;
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = set => ({
  historyJobs: [],

  setHistoryJobs: jobs => set({ historyJobs: jobs }),
});
