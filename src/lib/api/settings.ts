import { apiRequest } from './client';
import type { GcpCredentialsInfo } from '@/lib/transcriber/gcp-credentials';

export interface AppSettings {
  aiProvider: string;
  chunkDuration: number;
  overlapDuration: number;
  geminiApiKey: string;
  userGeminiApiKey: string;
  defaultModel?: string | null;
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentialsPath: string;
  gcpCredentialsJson?: string;
  gcpCredentialsStatus?: GcpCredentialsInfo;
}

export interface SaveSettingsInput {
  aiProvider?: string;
  chunkDuration?: number;
  overlapDuration?: number;
  userGeminiApiKey?: string;
  defaultModel?: string;
  gcpProjectId?: string;
  gcpLocation?: string;
  gcpCredentialsPath?: string;
  gcpCredentialsJson?: string;
}

export function fetchSettings(): Promise<AppSettings> {
  return apiRequest<AppSettings>('/api/settings');
}

export function saveSettings(input: SaveSettingsInput): Promise<AppSettings> {
  return apiRequest<AppSettings>('/api/settings', { method: 'POST', body: input });
}
