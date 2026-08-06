import { VertexAI } from '@google-cloud/vertexai';
import fs from 'fs';
import path from 'path';
import { GEMINI_TRANSCRIPTION_PROMPT, GEMINI_CHUNK_PROMPT } from './types';
import type { ChunkResult } from './types';
import { getMimeType, parseTranscriptionResponse } from './parser';
import { getGcpCredentialsInfo } from './gcp-credentials';
import { isQuotaError } from './error-utils';

export interface VertexOptions {
  projectId?: string | null;
  location?: string | null;
  credentialsPath?: string | null;
}

const VERTEX_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

/**
 * Initializes a VertexAI client using gcp-credentials.json or system GCP environment variables.
 */
export function createVertexClient(options?: VertexOptions): { client: VertexAI; projectId: string; location: string } {
  const creds = getGcpCredentialsInfo(options?.credentialsPath, options?.location);

  const projectId = options?.projectId || creds.projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = options?.location || creds.location || process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_REGION || 'us-central1';

  if (!creds.exists && !projectId) {
    throw new Error('GCP credentials not found. Please provide gcp-credentials.json or set GCP_PROJECT_ID.');
  }

  if (creds.filePath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = creds.filePath;
  }

  const googleAuthOptions: Record<string, any> = {};
  if (creds.filePath) {
    googleAuthOptions.keyFilename = creds.filePath;
  }

  const vertexClient = new VertexAI({
    project: projectId || undefined,
    location,
    googleAuthOptions: Object.keys(googleAuthOptions).length > 0 ? googleAuthOptions : undefined,
  });

  return { client: vertexClient, projectId: projectId || 'unknown', location };
}

function isTransientVertexError(err: any): boolean {
  if (!err) return false;
  const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (
    isQuotaError(err) ||
    errMsg.includes('429') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('quota') ||
    errMsg.includes('too many requests')
  ) {
    return true;
  }

  if (
    errMsg.includes('500') ||
    errMsg.includes('502') ||
    errMsg.includes('503') ||
    errMsg.includes('504') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('internal error') ||
    errMsg.includes('overloaded')
  ) {
    return true;
  }

  if (
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('socket hang up') ||
    errMsg.includes('network')
  ) {
    return true;
  }

  return false;
}

async function generateContentWithRetry(
  generativeModel: any,
  requestPayload: any,
  modelId: string,
  maxRetries: number = 2,
  initialDelayMs: number = 2000
): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      return await generativeModel.generateContent(requestPayload);
    } catch (err: any) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransient = isTransientVertexError(err);
      const isHardQuota = errMsg.includes('limit: 0') || errMsg.includes('per_day');

      if (isTransient && !isHardQuota && attempt <= maxRetries) {
        let delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 800);
        delayMs += jitter;

        console.warn(`[vertex] Transient error (${errMsg.substring(0, 80)}). Retrying attempt ${attempt}/${maxRetries} after ${Math.round(delayMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
}

export async function transcribeChunkWithVertex(
  filePath: string,
  modelId: string,
  chunkIndex: number,
  timeOffset: number,
  options?: VertexOptions
): Promise<ChunkResult> {
  const modelsToTry = [
    modelId,
    ...VERTEX_FALLBACK_MODELS.filter(m => m !== modelId),
  ];

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      if (i > 0) {
        console.warn(`[vertex] Chunk ${chunkIndex}: Fallback to model ${currentModel}`);
      }
      const result = await transcribeChunkWithVertexInternal(filePath, currentModel, chunkIndex, timeOffset, options);
      return {
        ...result,
        fallbackUsed: i > 0 || result.fallbackUsed,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[vertex] Chunk ${chunkIndex} failed with model ${currentModel}: ${errMsg}`);
      if (errMsg.includes('not found') || errMsg.includes('empty (0 bytes)')) {
        break;
      }
    }
  }

  throw lastError || new Error(`Vertex AI transcription failed for chunk ${chunkIndex}.`);
}

async function transcribeChunkWithVertexInternal(
  filePath: string,
  modelId: string,
  chunkIndex: number,
  timeOffset: number,
  options?: VertexOptions
): Promise<ChunkResult> {
  const { client } = createVertexClient(options);
  const generativeModel = client.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 16384,
    },
  });

  if (!fs.existsSync(filePath)) {
    throw new Error(`Chunk file not found: ${filePath}`);
  }
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error(`Chunk file is empty (0 bytes): ${filePath}`);
  }

  const mimeType = getMimeType(filePath);
  const audioBuffer = fs.readFileSync(filePath);
  const base64Data = audioBuffer.toString('base64');

  const prompt = GEMINI_CHUNK_PROMPT;
  const requestPayload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
  };

  console.log(`[vertex] Chunk ${chunkIndex}: sending inline audio (${fileStats.size} bytes) to Vertex model ${modelId}...`);
  const result = await generateContentWithRetry(generativeModel, requestPayload, modelId);

  const responseText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log(`[vertex] Chunk ${chunkIndex} response length: ${responseText.length} chars`);

  let segments = parseTranscriptionResponse(responseText);

  const meaningfulResponse = responseText.replace(/[\s\[\]]/g, '');
  if (segments.length === 0 && meaningfulResponse.length > 0) {
    throw new Error(`Vertex AI returned an unparseable response for chunk ${chunkIndex} (${responseText.substring(0, 120)}). Retrying...`);
  }

  if (timeOffset > 0) {
    segments = segments.map(seg => ({
      ...seg,
      startTime: seg.startTime + timeOffset,
      endTime: seg.endTime + timeOffset,
    }));
  }

  return {
    chunkIndex,
    segments,
    rawText: responseText,
    model: modelId,
  };
}

/**
 * Turns raw Vertex AI / Google auth errors into actionable, human-readable messages.
 */
export function explainVertexError(err: any): string {
  const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (errMsg.includes('unable to authenticate') || errMsg.includes('client_email') || errMsg.includes('private_key')) {
    return (
      'Authentication with Google failed. This usually means: (1) the service account JSON you pasted is incomplete ' +
      '(it must contain type, project_id, client_email, private_key, token_uri), (2) the key was revoked or regenerated, ' +
      'or (3) the service account is not valid. ' +
      'Paste the FULL JSON contents of the key file from Google Cloud Console → IAM & Admin → Service Accounts → Keys → Add Key → Create new key → JSON.'
    );
  }

  if (errMsg.includes('permission_denied') || errMsg.includes('403')) {
    return (
      'Permission denied (403). The service account does not have permission to call Vertex AI. ' +
      'Grant it the "Vertex AI User" (roles/aiplatform.user) role: Google Cloud Console → IAM & Admin → Grant Access → ' +
      'add the service account email → select "Vertex AI User".'
    );
  }

  if (errMsg.includes('not found') || errMsg.includes('404')) {
    return (
      'Not found (404). Check that the GCP Project ID is correct and that the Vertex AI API is enabled for it. ' +
      'Enable it at Google Cloud Console → Vertex AI → Get Started.'
    );
  }

  if (errMsg.includes('api key') || errMsg.includes('apikey')) {
    return 'Vertex AI uses service account keys, not API keys. Paste a full service-account JSON key (from IAM & Admin → Service Accounts → Keys).';
  }

  if (errMsg.includes('billing') || errMsg.includes('billing is disabled')) {
    return 'Billing is not enabled for this GCP project. Gemini models on Vertex AI require a billing-enabled project. Enable billing in Google Cloud Console → Billing.';
  }

  if (errMsg.includes('quota') || errMsg.includes('quota exceeded') || errMsg.includes('429')) {
    return 'Quota exceeded (429) for the Vertex AI Gemini model on this project. You can retry later or choose a different model/region.';
  }

  return errMsg;
}

export async function testVertexConnection(options?: VertexOptions, modelId?: string): Promise<{ success: boolean; projectId: string; location: string; model?: string; error?: string }> {
  try {
    const { client, projectId, location } = createVertexClient(options);
    const model = client.getGenerativeModel({ model: modelId || 'gemini-2.5-flash' });
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Say exactly: Vertex OK' }] }],
    });
    const text = res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text) {
      return { success: true, projectId, location, model: modelId || 'gemini-2.5-flash' };
    }
    return { success: false, projectId, location, model: modelId || 'gemini-2.5-flash', error: 'Empty response from Vertex AI' };
  } catch (err: any) {
    const creds = getGcpCredentialsInfo(options?.credentialsPath, options?.location);
    return {
      success: false,
      projectId: options?.projectId || creds.projectId || 'unknown',
      location: creds.location,
      model: modelId || 'gemini-2.5-flash',
      error: explainVertexError(err),
    };
  }
}
