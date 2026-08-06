import type { StateCreator } from 'zustand';
import type { AppState, BatchJob } from '../types';

export interface BatchSlice {
  batchJobs: BatchJob[];
  setBatchJobs: (jobs: BatchJob[]) => void;
  updateBatchJob: (id: string, update: Partial<BatchJob>) => void;
  clearBatch: () => void;
}

export const createBatchSlice: StateCreator<AppState, [], [], BatchSlice> = set => ({
  batchJobs: [],

  setBatchJobs: jobs => set({ batchJobs: jobs }),

  updateBatchJob: (id, update) => set(prev => ({
    batchJobs: prev.batchJobs.map(j => j.id === id ? { ...j, ...update } : j),
  })),

  clearBatch: () => set({ batchJobs: [] }),
});
