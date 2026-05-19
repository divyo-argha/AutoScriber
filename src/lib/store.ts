import { create } from 'zustand';
import type { TranscriptionSegment, ModelInfo } from './transcriber/types';
import { AVAILABLE_MODELS } from './transcriber/types';

export type AppView = 'upload' | 'processing' | 'result' | 'history' | 'batch' | 'thematic';

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
}

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
  setProcessingState: (state: Partial<{
    isProcessing: boolean;
    processingProgress: number;
    processingStatus: string;
    chunksTotal: number;
    chunksDone: number;
    currentChunkIndex: number;
  }>) => void;

  // Results
  transcriptionSegments: TranscriptionSegment[];
  transcriptionText: string;
  jobId: string | null;
  setTranscriptionResult: (segments: TranscriptionSegment[], text: string, jobId?: string) => void;

  // Audio playback state
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
  setAudioPlayback: (state: Partial<{
    audioUrl: string | null;
    isPlaying: boolean;
    currentTime: number;
    audioDuration: number;
    activeSegmentIndex: number;
  }>) => void;

  // Settings
  geminiApiKey: string;
  ollamaUrl: string;
  chunkDuration: number;
  overlapDuration: number;
  setSettings: (settings: Partial<{
    ollamaUrl: string;
    chunkDuration: number;
    overlapDuration: number;
  }>) => void;

  // Ollama models
  ollamaModels: string[];
  setOllamaModels: (models: string[]) => void;

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
  selectedModel: 'gemini-2.5-flash',
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
  transcriptionSegments: [] as TranscriptionSegment[],
  transcriptionText: '',
  jobId: null as string | null,
  audioUrl: null as string | null,
  audioUrl: null as string | null,
  isPlaying: false,
  currentTime: 0,
  audioDuration: 0,
  activeSegmentIndex: -1,
  geminiApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  chunkDuration: 300,
  overlapDuration: 10,
  ollamaModels: [] as string[],
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

  setTranscriptionResult: (segments, text, jobId) => set({
    transcriptionSegments: segments,
    transcriptionText: text,
    ...(jobId ? { jobId } : {}),
  }),

  setAudioPlayback: (state) => set((prev) => ({ ...prev, ...state })),

  setSettings: (settings) => set((prev) => ({ ...prev, ...settings })),

  setOllamaModels: (models) => set({ ollamaModels: models }),

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
      ollamaUrl: prev.ollamaUrl,
      chunkDuration: prev.chunkDuration,
      overlapDuration: prev.overlapDuration,
      ollamaModels: prev.ollamaModels,
      historyJobs: prev.historyJobs,
      selectedModel: prev.selectedModel,
    };
  }),
}));
