import { apiRequest } from './client';

export interface StartTranscriptionInput {
  file: File;
  model: string;
  chunkDuration: number;
  overlapDuration: number;
}

export interface StartTranscriptionResult {
  jobId: string;
  status: string;
}

export function startTranscription(input: StartTranscriptionInput): Promise<StartTranscriptionResult> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('model', input.model);
  formData.append('chunkDuration', String(input.chunkDuration));
  formData.append('overlapDuration', String(input.overlapDuration));

  return apiRequest<StartTranscriptionResult>('/api/transcribe', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Raw POST for the transcription endpoint (used when callers need to attach
 * their own AbortController to cancel an in-flight upload).
 */
export function startTranscriptionWithSignal(
  input: StartTranscriptionInput,
  signal: AbortSignal
): Promise<StartTranscriptionResult> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('model', input.model);
  formData.append('chunkDuration', String(input.chunkDuration));
  formData.append('overlapDuration', String(input.overlapDuration));

  return apiRequest<StartTranscriptionResult>('/api/transcribe', {
    method: 'POST',
    body: formData,
    signal,
  });
}
