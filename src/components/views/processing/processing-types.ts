import type { ChunkResult } from '@/lib/transcriber/types';

export interface ProcessingViewState {
  uploadedFileName: string;
  modelName: string;
  modelProvider: string;
  selectedModel: string;
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  chunkDuration: number;
  liveChunkResults: ChunkResult[];
  paused: boolean;
  cancelling: boolean;
  estimatedTime: string;
  isLocationError: boolean;
  isAuthError: boolean;
  isCancelled: boolean;
  isFailed: boolean;
}
