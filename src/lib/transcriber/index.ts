import { transcribeChunkWithGemini } from './gemini';
import { transcribeChunkWithVertex } from './vertex';
import { getGcpCredentialsInfo } from './gcp-credentials';
import type { ChunkResult } from './types';

export interface TranscribeChunkOptions {
  filePath: string;
  modelId: string;
  chunkIndex: number;
  timeOffset: number;
  aiProvider?: string; // 'auto', 'vertex', 'gemini'
  geminiApiKey?: string;
  gcpProjectId?: string;
  gcpLocation?: string;
  gcpCredentialsPath?: string;
}

/**
 * Dispatches chunk transcription to the appropriate AI provider (Vertex AI vs Gemini AI Studio).
 */
export async function transcribeChunk(options: TranscribeChunkOptions): Promise<ChunkResult> {
  const {
    filePath,
    modelId,
    chunkIndex,
    timeOffset,
    aiProvider = 'auto',
    geminiApiKey = '',
    gcpProjectId,
    gcpLocation,
    gcpCredentialsPath,
  } = options;

  const gcpCreds = getGcpCredentialsInfo(gcpCredentialsPath, gcpLocation);

  // Determine active provider:
  // If explicitly 'vertex', or if 'auto' and gcp-credentials.json exists (or no Gemini API key is set), use Vertex AI.
  const shouldUseVertex =
    aiProvider === 'vertex' ||
    (aiProvider === 'auto' && gcpCreds.exists) ||
    (aiProvider === 'auto' && !geminiApiKey && (gcpCreds.exists || !!process.env.GCP_PROJECT_ID));

  if (shouldUseVertex) {
    if (!gcpCreds.exists && !gcpProjectId && !process.env.GCP_PROJECT_ID) {
      throw new Error(
        'Vertex AI provider selected but gcp-credentials.json was not found. Please upload or place gcp-credentials.json in the project root.'
      );
    }
    console.log(`[transcription-router] Chunk ${chunkIndex}: Using Google Cloud Vertex AI (Project: ${gcpCreds.projectId || gcpProjectId || 'env'}, Region: ${gcpCreds.location})`);
    return transcribeChunkWithVertex(filePath, modelId, chunkIndex, timeOffset, {
      projectId: gcpProjectId || gcpCreds.projectId,
      location: gcpLocation || gcpCreds.location,
      credentialsPath: gcpCredentialsPath || gcpCreds.filePath,
    });
  }

  if (!geminiApiKey) {
    throw new Error('Gemini API key or GCP Vertex credentials (gcp-credentials.json) are required.');
  }

  console.log(`[transcription-router] Chunk ${chunkIndex}: Using Google AI Studio (Gemini API)`);
  return transcribeChunkWithGemini(filePath, geminiApiKey, modelId, chunkIndex, timeOffset);
}
