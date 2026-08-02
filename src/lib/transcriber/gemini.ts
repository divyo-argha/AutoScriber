import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GEMINI_TRANSCRIPTION_PROMPT, GEMINI_CHUNK_PROMPT } from './types';
import type { TranscriptionSegment, ChunkResult } from './types';
import { isQuotaError } from './error-utils';
import fs from 'fs';
import path from 'path';

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp3': 'audio/mp3',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.aac': 'audio/aac',
    '.wma': 'audio/wma',
  };
  return mimeMap[ext] || 'audio/mp3';
}

function parseTranscriptionResponse(text: string): TranscriptionSegment[] {
  let jsonStr = text.trim();

  if (!jsonStr) return [];

  // Remove markdown code fences
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Extract JSON array - be strict about it
  const arrayMatch = jsonStr.match(/^\s*\[[\s\S]*\]\s*$/);
  if (!arrayMatch) {
    // Try to find array within text
    const innerMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (innerMatch) {
      jsonStr = innerMatch[0];
    } else {
      console.error('[gemini] No JSON array found in response');
      return [];
    }
  } else {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.error('[gemini] Response is not an array');
      return [];
    }

    return parsed
      .filter(seg => seg && typeof seg === 'object')
      .map((seg: Record<string, unknown>) => ({
        speaker: String(seg.speaker || 'Speaker Unknown'),
        startTime: Number(seg.startTime) || 0,
        endTime: Number(seg.endTime) || 0,
        text: String(seg.text || ''),
      }))
      .filter(seg => seg.text.trim().length > 0);
  } catch (parseErr) {
    console.error('[gemini] JSON parse failed:', parseErr);
    console.error('[gemini] Attempted to parse:', jsonStr.substring(0, 200));
    return [];
  }
}

/**
 * Create a GoogleGenerativeAI client.
 */
function createGenAIClient(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  // Rate limits (429) & quota errors
  if (
    isQuotaError(err) ||
    errMsg.includes('429') ||
    errMsg.includes('too many requests') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted')
  ) {
    return true;
  }

  // Transient server errors (5xx)
  if (
    errMsg.includes('500') ||
    errMsg.includes('502') ||
    errMsg.includes('503') ||
    errMsg.includes('504') ||
    errMsg.includes('internal error') ||
    errMsg.includes('bad gateway') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('overloaded')
  ) {
    return true;
  }

  // Network connection failures, timeouts, & Node fetch errors
  if (
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('socket hang up') ||
    errMsg.includes('network') ||
    errMsg.includes('und_err') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('aborted') ||
    errMsg.includes('failed to fetch')
  ) {
    return true;
  }

  return false;
}

/**
 * Call generateContent with exponential backoff on rate limits (429), transient errors (5xx), or network issues (fetch failed).
 */
async function generateContentWithRetry(
  model: any,
  contents: any[],
  maxRetries: number = 5,
  initialDelayMs: number = 2000
): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      return await model.generateContent(contents);
    } catch (err: any) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransient = isTransientError(err);
      
      if (isTransient && attempt <= maxRetries) {
        let delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        
        // Try to extract dynamic retry delay from error message or response headers if available
        const retryDelayMatch = errMsg.match(/retryDelay["\s:]+(\d+)s/i) || errMsg.match(/retry in ([\d.]+)\s*s/i);
        if (retryDelayMatch && retryDelayMatch[1]) {
          const seconds = parseFloat(retryDelayMatch[1]);
          if (!isNaN(seconds) && seconds > 0) {
            delayMs = (seconds + 1) * 1000;
          }
        } else if (err?.status === 429 && err?.headers?.get?.('retry-after')) {
          const retryAfter = parseInt(err.headers.get('retry-after'), 10);
          if (!isNaN(retryAfter) && retryAfter > 0) {
            delayMs = (retryAfter + 1) * 1000;
          }
        }
        
        console.warn(`[gemini] Transient/Network error hit (${errMsg.substring(0, 80)}). Retrying attempt ${attempt}/${maxRetries} after ${Math.round(delayMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

let lastRequestTimestamp = 0;

/**
 * Ensures requests adhere to Free Tier Rate Limits (e.g. 10 RPM -> ~6s delay between requests).
 */
async function enforceRateLimitPacing(minDelayMs: number = 6000): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (lastRequestTimestamp > 0 && elapsed < minDelayMs) {
    const waitTime = minDelayMs - elapsed;
    console.log(`[gemini] Free Tier rate limit pacing: waiting ${Math.round(waitTime / 1000)}s before next request...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTimestamp = Date.now();
}

export async function transcribeWithGemini(
  filePath: string,
  apiKey: string,
  modelId: string = 'gemini-2.5-flash',
  timeOffset: number = 0
): Promise<ChunkResult> {
  const modelsToTry = [
    modelId,
    ...GEMINI_FALLBACK_MODELS.filter(m => m !== modelId),
  ];

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      if (i > 0) {
        console.warn(`[gemini] Attempting fallback to Gemini model: ${currentModel}`);
      }
      const result = await transcribeWithGeminiInternal(filePath, apiKey, currentModel, timeOffset);
      return {
        ...result,
        fallbackUsed: i > 0 || result.fallbackUsed,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[gemini] Full transcription failed with model ${currentModel}: ${errMsg}`);
      
      // If it's a file error, don't try other models
      if (errMsg.includes('not found') || errMsg.includes('empty') || errMsg.includes('0 bytes')) {
        break;
      }
    }
  }

  throw lastError || new Error('Transcription failed with all models.');
}

async function transcribeWithGeminiInternal(
  filePath: string,
  apiKey: string,
  modelId: string = 'gemini-2.5-flash',
  timeOffset: number = 0
): Promise<ChunkResult> {
  const genAI = createGenAIClient(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error(`Audio file is empty (0 bytes): ${filePath}`);
  }

  const mimeType = getMimeType(filePath);
  const prompt = timeOffset > 0 ? GEMINI_CHUNK_PROMPT : GEMINI_TRANSCRIPTION_PROMPT;

  let result;
  let fileToCleanup: string | null = null;

  try {
    if (fileStats.size >= FILE_SIZE_THRESHOLD) {
      console.log(`[gemini] File size ${fileStats.size} bytes is >= 5MB. Uploading via Files API...`);
      const fileManager = new GoogleAIFileManager(apiKey);
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: path.basename(filePath),
      });
      
      let file = uploadResult.file;
      fileToCleanup = file.name;
      
      console.log(`[gemini] File uploaded as ${file.uri}. Waiting for ACTIVE...`);
      while (file.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(file.name);
      }
      
      if (file.state === 'FAILED') {
        throw new Error('Gemini Files API failed to process the uploaded audio.');
      }
      
      const filePart = {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType,
        },
      };

      result = await generateContentWithRetry(model, [prompt, filePart]);
    } else {
      console.log(`[gemini] File size ${fileStats.size} bytes is < 5MB. Transcribing inline...`);
      const audioData = fs.readFileSync(filePath);
      const audioPart = {
        inlineData: {
          data: audioData.toString('base64'),
          mimeType,
        },
      };

      result = await generateContentWithRetry(model, [prompt, audioPart]);
    }

    const response = result.response;
    const text = response.text();

    console.log(`[gemini] API response length: ${text.length} chars`);

    let segments = parseTranscriptionResponse(text);

    if (timeOffset > 0) {
      segments = segments.map(seg => ({
        ...seg,
        startTime: seg.startTime + timeOffset,
        endTime: seg.endTime + timeOffset,
      }));
    }

    return {
      chunkIndex: 0,
      segments,
      rawText: text,
    };
  } finally {
    if (fileToCleanup) {
      try {
        console.log(`[gemini] Cleaning up file from Gemini Files API: ${fileToCleanup}`);
        const fileManager = new GoogleAIFileManager(apiKey);
        await fileManager.deleteFile(fileToCleanup);
      } catch (cleanupErr) {
        console.error(`[gemini] Failed to delete file ${fileToCleanup}:`, cleanupErr);
      }
    }
  }
}

export async function transcribeChunkWithGemini(
  filePath: string,
  apiKey: string,
  modelId: string,
  chunkIndex: number,
  timeOffset: number
): Promise<ChunkResult> {
  const modelsToTry = [
    modelId,
    ...GEMINI_FALLBACK_MODELS.filter(m => m !== modelId),
  ];

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      if (i > 0) {
        console.warn(`[gemini] Chunk ${chunkIndex}: Attempting fallback to Gemini model: ${currentModel}`);
      }
      const result = await transcribeChunkWithGeminiInternal(filePath, apiKey, currentModel, chunkIndex, timeOffset);
      return {
        ...result,
        fallbackUsed: i > 0 || result.fallbackUsed,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[gemini] Chunk ${chunkIndex} failed with model ${currentModel}: ${errMsg}`);
      
      // If it's a file error, don't try other models
      if (errMsg.includes('not found') || errMsg.includes('empty') || errMsg.includes('0 bytes')) {
        break;
      }
    }
  }

  throw lastError || new Error(`Transcription failed for chunk ${chunkIndex} with all models.`);
}

async function transcribeChunkWithGeminiInternal(
  filePath: string,
  apiKey: string,
  modelId: string,
  chunkIndex: number,
  timeOffset: number
): Promise<ChunkResult> {
  const genAI = createGenAIClient(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  if (!fs.existsSync(filePath)) {
    throw new Error(`Chunk file not found: ${filePath}`);
  }
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error(`Chunk file is empty (0 bytes): ${filePath}`);
  }

  const mimeType = getMimeType(filePath);
  let result;
  let fileToCleanup: string | null = null;

  try {
    if (fileStats.size >= FILE_SIZE_THRESHOLD) {
      console.log(`[gemini] Chunk ${chunkIndex} size ${fileStats.size} bytes is >= 5MB. Uploading via Files API...`);
      const fileManager = new GoogleAIFileManager(apiKey);
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: `chunk_${chunkIndex}_${path.basename(filePath)}`,
      });
      
      let file = uploadResult.file;
      fileToCleanup = file.name;
      
      console.log(`[gemini] Chunk ${chunkIndex} uploaded as ${file.uri}. Waiting for ACTIVE...`);
      while (file.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(file.name);
      }
      
      if (file.state === 'FAILED') {
        throw new Error(`Gemini Files API failed to process uploaded chunk ${chunkIndex}.`);
      }
      
      const filePart = {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType,
        },
      };

      result = await generateContentWithRetry(model, [GEMINI_CHUNK_PROMPT, filePart]);
    } else {
      console.log(`[gemini] Chunk ${chunkIndex} size ${fileStats.size} bytes is < 5MB. Transcribing inline...`);
      const audioData = fs.readFileSync(filePath);
      const audioPart = {
        inlineData: {
          data: audioData.toString('base64'),
          mimeType,
        },
      };

      result = await generateContentWithRetry(model, [GEMINI_CHUNK_PROMPT, audioPart]);
    }

    const response = result.response;
    const text = response.text();

    console.log(`[gemini] Chunk ${chunkIndex} response length: ${text.length} chars`);

    let segments = parseTranscriptionResponse(text);

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
      rawText: text,
    };
  } finally {
    if (fileToCleanup) {
      try {
        console.log(`[gemini] Cleaning up chunk file from Gemini Files API: ${fileToCleanup}`);
        const fileManager = new GoogleAIFileManager(apiKey);
        await fileManager.deleteFile(fileToCleanup);
      } catch (cleanupErr) {
        console.error(`[gemini] Failed to delete chunk file ${fileToCleanup}:`, cleanupErr);
      }
    }
  }
}

export async function testGeminiConnection(apiKey: string, modelId: string = 'gemini-2.5-flash'): Promise<boolean> {
  try {
    const genAI = createGenAIClient(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent('Say "OK" if you can hear me.');
    return !!result.response.text();
  } catch {
    return false;
  }
}
