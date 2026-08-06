import { apiRequest } from './client';

export interface CleanupResult {
  success: boolean;
  filesDeleted?: number;
  formattedFreed?: string;
  error?: string;
}

export function cleanupAudioStorage(): Promise<CleanupResult> {
  return apiRequest<CleanupResult>('/api/audio/cleanup', { method: 'POST' });
}
