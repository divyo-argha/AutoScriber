import { create } from 'zustand';
import type { AppState } from './types';
import { createViewSlice } from './slices/view-slice';
import { createModelSlice } from './slices/model-slice';
import { createFileSlice } from './slices/file-slice';
import { createProcessingSlice } from './slices/processing-slice';
import { createPlaybackSlice } from './slices/playback-slice';
import { createSettingsSlice } from './slices/settings-slice';
import { createHistorySlice } from './slices/history-slice';
import { createBatchSlice } from './slices/batch-slice';
import { createResetSlice } from './slices/reset-slice';
import { createInitialState } from './initial';

/**
 * Composed application store. Slices are kept small and focused in
 * `./slices/*`; this file only wires them together.
 */
export const useAppStore = create<AppState>()((...args) => ({
  ...createInitialState(),
  ...createViewSlice(...args),
  ...createModelSlice(...args),
  ...createFileSlice(...args),
  ...createProcessingSlice(...args),
  ...createPlaybackSlice(...args),
  ...createSettingsSlice(...args),
  ...createHistorySlice(...args),
  ...createBatchSlice(...args),
  ...createResetSlice(...args),
}));

export type { AppView, HistoryJob, BatchJob } from './types';
export type { ProcessingState, PlaybackState, SettingsState } from './types';
