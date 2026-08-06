import { apiRequest } from './client';

export interface GeminiTestResult {
  connected: boolean;
  workingModel?: string;
  fallbackUsed?: boolean;
  disabledModels?: Record<string, string>;
  error?: string;
  errorType?: 'no_key' | 'auth_failed' | 'location_blocked' | 'quota_exceeded' | 'model_not_found' | 'unknown';
  suggestion?: string;
}

export function testGeminiConnection(model: string, apiKey?: string): Promise<GeminiTestResult> {
  const params = new URLSearchParams({ model });
  if (apiKey) params.set('apiKey', apiKey);
  return apiRequest<GeminiTestResult>(`/api/gemini-test?${params.toString()}`);
}

export interface VertexTestInput {
  gcpProjectId?: string;
  gcpLocation?: string;
  gcpCredentialsPath?: string;
  gcpCredentialsJson?: string;
  modelId?: string;
}

export interface VertexTestResult {
  success: boolean;
  projectId?: string;
  location?: string;
  model?: string;
  error?: string;
}

export function testVertexConnection(input: VertexTestInput): Promise<VertexTestResult> {
  return apiRequest<VertexTestResult>('/api/vertex-test', { method: 'POST', body: input });
}
