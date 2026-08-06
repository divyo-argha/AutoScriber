import { apiRequest } from './client';
import type { TranscriptionResult } from '@/lib/transcriber/types';

export interface JobRecord {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  status: string;
  controlStatus: string;
  progress: number;
  model: string;
  chunksTotal: number;
  chunksDone: number;
  errorMessage: string | null;
  result: string | null;
  chunkResults: string | null;
  audioPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JobAction = 'pause' | 'resume' | 'cancel';

export function listJobs(): Promise<{ jobs: JobRecord[] }> {
  return apiRequest<{ jobs: JobRecord[] }>('/api/jobs');
}

export function getJob(jobId: string): Promise<JobRecord> {
  return apiRequest<JobRecord>(`/api/jobs?id=${encodeURIComponent(jobId)}`);
}

export function controlJob(id: string, action: JobAction): Promise<JobRecord> {
  return apiRequest<JobRecord>('/api/jobs', { method: 'POST', body: { id, action } });
}

export function deleteJob(jobId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/jobs?id=${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

/** Parses a raw `result` column (string) into a typed TranscriptionResult. */
export function parseJobResult(job: Pick<JobRecord, 'result'>): TranscriptionResult | null {
  if (!job.result) return null;
  try {
    return typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
  } catch {
    return null;
  }
}

/** Parses a raw `chunkResults` column into a ChunkResult array. */
export function parseChunkResults(job: Pick<JobRecord, 'chunkResults'>): unknown[] {
  if (!job.chunkResults) return [];
  try {
    return typeof job.chunkResults === 'string' ? JSON.parse(job.chunkResults) : job.chunkResults;
  } catch {
    return [];
  }
}
