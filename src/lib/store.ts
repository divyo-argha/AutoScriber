import { create } from 'zustand';
import type { TranscriptionSegment, ModelInfo } from './transcriber/types';
import { AVAILABLE_MODELS } from './transcriber/types';

export type AppView = 'upload' | 'processing' | 'result' | 'history' | 'batch';

interface HistoryJob {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  status: string;
  model: string;
  createdAt: string;
  segmentsCount: number;
  speakersCount: number;
}

export interface BatchJob {
  id: string; // local uuid
  file: File;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  segments: import('./transcriber/types').TranscriptionSegment[];
  fullText: string;
  jobId: string | null; // server job id
  error: string | null;
  skippedChunks: number[];
}

type ProcessingState = {
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  currentChunkIndex: number;
  jobId: string | null;
  liveChunkResults: import('./transcriber/types').ChunkResult[];
};

type PlaybackState = {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
};

type SettingsState = {
  chunkDuration: number;
  overlapDuration: number;
  geminiApiKey: string;
  userGeminiApiKey: string;
};

interface AppState {
  // Current view
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Selected model
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: ModelInfo[];

  // File info
  uploadedFile: File | null;
  uploadedFileName: string;
  uploadedFileSize: number;
  uploadedFileDuration: number;
  setUploadedFile: (file: File | null) => void;
  setUploadedFileDuration: (duration: number) => void;

  // Processing state
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  currentChunkIndex: number;
  liveChunkResults: import('./transcriber/types').ChunkResult[];
  setProcessingState: (state: Partial<ProcessingState>) => void;

  // Results
  transcriptionSegments: TranscriptionSegment[];
  transcriptionText: string;
  jobId: string | null;
  transcriptionSkippedChunks: number[];
  setTranscriptionResult: (segments: TranscriptionSegment[], text: string, jobId?: string, skippedChunks?: number[]) => void;

  // Audio playback state
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
  setAudioPlayback: (state: Partial<PlaybackState>) => void;

  // Settings
  geminiApiKey: string;
  chunkDuration: number;
  overlapDuration: number;
  userGeminiApiKey: string;
  setSettings: (settings: Partial<SettingsState>) => void;

  // History
  historyJobs: HistoryJob[];
  setHistoryJobs: (jobs: HistoryJob[]) => void;

  // Batch
  batchJobs: BatchJob[];
  setBatchJobs: (jobs: BatchJob[]) => void;
  updateBatchJob: (id: string, update: Partial<BatchJob>) => void;
  clearBatch: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentView: 'upload' as AppView,
  selectedModel: 'gemini-2.0-flash',
  availableModels: AVAILABLE_MODELS,
  uploadedFile: null as File | null,
  uploadedFileName: '',
  uploadedFileSize: 0,
  uploadedFileDuration: 0,
  isProcessing: false,
  processingProgress: 0,
  processingStatus: '',
  chunksTotal: 0,
  chunksDone: 0,
  currentChunkIndex: 0,
  liveChunkResults: [] as import('./transcriber/types').ChunkResult[],
  transcriptionSegments: [] as TranscriptionSegment[],
  transcriptionText: '',
  jobId: null as string | null,
  transcriptionSkippedChunks: [] as number[],
  audioUrl: null as string | null,
  isPlaying: false,
  currentTime: 0,
  audioDuration: 0,
  activeSegmentIndex: -1,
  geminiApiKey: '',
  chunkDuration: 300,
  overlapDuration: 30,
  userGeminiApiKey: '',
  historyJobs: [] as HistoryJob[],
  batchJobs: [] as BatchJob[],
};

export type { HistoryJob };

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentView: (view) => set({ currentView: view }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setUploadedFile: (file) => set({
    uploadedFile: file,
    uploadedFileName: file?.name || '',
    uploadedFileSize: file?.size || 0,
  }),

  setUploadedFileDuration: (duration) => set({ uploadedFileDuration: duration }),

  setProcessingState: (state) => set((prev) => ({ ...prev, ...state })),

  setTranscriptionResult: (segments, text, jobId, skippedChunks) => set({
    transcriptionSegments: segments,
    transcriptionText: text,
    transcriptionSkippedChunks: skippedChunks || [],
    ...(jobId ? { jobId } : {}),
  }),

  setAudioPlayback: (state) => set((prev) => ({ ...prev, ...state })),

  setSettings: (settings) => set((prev) => ({ ...prev, ...settings })),

  setHistoryJobs: (jobs) => set({ historyJobs: jobs }),

  setBatchJobs: (jobs) => set({ batchJobs: jobs }),
  updateBatchJob: (id, update) => set((prev) => ({
    batchJobs: prev.batchJobs.map(j => j.id === id ? { ...j, ...update } : j),
  })),
  clearBatch: () => set({ batchJobs: [] }),

  reset: () => set((prev) => {
    // Revoke old audio URL to prevent memory leak
    if (prev.audioUrl && !prev.audioUrl.startsWith('/api/')) {
      try { URL.revokeObjectURL(prev.audioUrl); } catch {}
    }
    return {
      ...initialState,
      // Preserve settings
      geminiApiKey: prev.geminiApiKey,
      chunkDuration: prev.chunkDuration,
      overlapDuration: prev.overlapDuration,
      userGeminiApiKey: prev.userGeminiApiKey,
      historyJobs: prev.historyJobs,
      selectedModel: prev.selectedModel,
    };
  }),
}));
