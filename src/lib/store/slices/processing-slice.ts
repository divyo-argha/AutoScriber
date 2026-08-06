import type { StateCreator } from 'zustand';
import type { AppState, ProcessingState } from '../types';
import type { TranscriptionSegment, ChunkResult } from '@/lib/transcriber/types';

export interface ProcessingSlice {
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  chunksTotal: number;
  chunksDone: number;
  currentChunkIndex: number;
  liveChunkResults: ChunkResult[];
  jobId: string | null;
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
}

export const createProcessingSlice: StateCreator<AppState, [], [], ProcessingSlice> = set => ({
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

  setProcessingState: state => set(prev => ({ ...prev, ...state })),

  setTranscriptionResult: (segments, text, jobId, skippedChunks) => set({
    transcriptionSegments: segments,
    transcriptionText: text,
    transcriptionSkippedChunks: skippedChunks || [],
    ...(jobId ? { jobId } : {}),
  }),
});
