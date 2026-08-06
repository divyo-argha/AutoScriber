import type { TranscriptionSegment, ModelInfo, ChunkResult } from '@/lib/transcriber/types';

export type AppView = 'upload' | 'processing' | 'result';

export interface HistoryJob {
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
  segments: TranscriptionSegment[];
  fullText: string;
  jobId: string | null; // server job id
  error: string | null;
  skippedChunks: number[];
}

export type ProcessingState = {
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  currentChunkIndex: number;
  jobId: string | null;
  liveChunkResults: ChunkResult[];
  paused: boolean;
};

export type PlaybackState = {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
};

export type SettingsState = {
  chunkDuration: number;
  overlapDuration: number;
  geminiApiKey: string;
  userGeminiApiKey: string;
};

/** A seek command broadcast through the store so any component can drive the active player. */
export type SeekRequest = {
  requestId: number;
  time: number;
};

export interface AppState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: ModelInfo[];
  disabledModels: Record<string, string>;
  setDisabledModel: (modelId: string, reason: string | null) => void;
  clearDisabledModels: () => void;

  uploadedFile: File | null;
  uploadedFileName: string;
  uploadedFileSize: number;
  uploadedFileDuration: number;
  setUploadedFile: (file: File | null) => void;
  setUploadedFileDuration: (duration: number) => void;

  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  currentChunkIndex: number;
  liveChunkResults: ChunkResult[];
  jobId: string | null;
  paused: boolean;
  setProcessingState: (state: Partial<ProcessingState>) => void;

  transcriptionSegments: TranscriptionSegment[];
  transcriptionText: string;
  transcriptionSkippedChunks: number[];
  setTranscriptionResult: (
    segments: TranscriptionSegment[],
    text: string,
    jobId?: string,
    skippedChunks?: number[]
  ) => void;

  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  audioDuration: number;
  activeSegmentIndex: number;
  seekRequest: SeekRequest | null;
  setAudioPlayback: (state: Partial<PlaybackState>) => void;
  seekTo: (time: number) => void;

  geminiApiKey: string;
  chunkDuration: number;
  overlapDuration: number;
  userGeminiApiKey: string;
  setSettings: (settings: Partial<SettingsState>) => void;

  historyJobs: HistoryJob[];
  setHistoryJobs: (jobs: HistoryJob[]) => void;

  batchJobs: BatchJob[];
  setBatchJobs: (jobs: BatchJob[]) => void;
  updateBatchJob: (id: string, update: Partial<BatchJob>) => void;
  clearBatch: () => void;

  reset: () => void;
}
