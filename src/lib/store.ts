import { create } from 'zustand';
import type { TranscriptionSegment, ModelInfo } from './transcriber/types';
import { AVAILABLE_MODELS } from './transcriber/types';

export type AppView = 'upload' | 'processing' | 'result';

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
  setTranscriptionResult: (segments: TranscriptionSegment[], text: string) => void;
  
  // Settings
  geminiApiKey: string;
  ollamaUrl: string;
  chunkDuration: number;
  overlapDuration: number;
  setSettings: (settings: Partial<{
    geminiApiKey: string;
    ollamaUrl: string;
    chunkDuration: number;
    overlapDuration: number;
  }>) => void;
  
  // Ollama models
  ollamaModels: string[];
  setOllamaModels: (models: string[]) => void;
  
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
  geminiApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  chunkDuration: 300,
  overlapDuration: 10,
  ollamaModels: [] as string[],
};

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
  
  setTranscriptionResult: (segments, text) => set({
    transcriptionSegments: segments,
    transcriptionText: text,
  }),
  
  setSettings: (settings) => set((prev) => ({ ...prev, ...settings })),
  
  setOllamaModels: (models) => set({ ollamaModels: models }),
  
  reset: () => set({
    ...initialState,
    geminiApiKey: useAppStore.getState().geminiApiKey,
    ollamaUrl: useAppStore.getState().ollamaUrl,
    chunkDuration: useAppStore.getState().chunkDuration,
    overlapDuration: useAppStore.getState().overlapDuration,
    ollamaModels: useAppStore.getState().ollamaModels,
  }),
}));
