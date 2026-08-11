import type { AppState, BatchJob, HistoryJob } from './types';
import { ALL_MODELS } from '@/lib/transcriber/types';

/**
 * Returns a fresh copy of the default store data fields. Called once when the
 * store is created and again by `reset()` so repeated resets never share
 * references. Action functions are provided by the slices and survive the
 * shallow merge performed by `reset()`.
 */
export function createInitialState(): Partial<AppState> {
  return {
    currentView: 'upload',
    selectedModel: 'gemini-2.0-flash',
    availableModels: ALL_MODELS,
    disabledModels: {},

    uploadedFile: null,
    uploadedFileName: '',
    uploadedFileSize: 0,
    uploadedFileDuration: 0,

    isProcessing: false,
    processingProgress: 0,
    processingStatus: '',
    chunksTotal: 0,
    chunksDone: 0,
    currentChunkIndex: 0,
    liveChunkResults: [],
    jobId: null,

    transcriptionSegments: [],
    transcriptionText: '',
    transcriptionSkippedChunks: [],

    audioUrl: null,
    isPlaying: false,
    currentTime: 0,
    audioDuration: 0,
    activeSegmentIndex: -1,
    seekRequest: null,

    geminiApiKey: '',
    chunkDuration: 300,
    overlapDuration: 30,
    userGeminiApiKey: '',

    historyJobs: [] as HistoryJob[],
    batchJobs: [] as BatchJob[],
  };
}
