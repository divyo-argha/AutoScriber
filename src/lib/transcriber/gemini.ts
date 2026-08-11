import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GEMINI_TRANSCRIPTION_PROMPT, GEMINI_CHUNK_PROMPT } from './types';
import type { ChunkResult } from './types';
import { getMimeType, parseTranscriptionResponse } from './parser';
import { withTransientRetry } from './retry';
import fs from 'fs';
import path from 'path';

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Create a GoogleGenerativeAI client.
 */
function createGenAIClient(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

/** Call generateContent with shared transient-error retry + model-aware pacing. */
function generateContentWithRetry(
  model: any,
  contents: any[],
  modelId: string = 'gemini-2.0-flash'
): Promise<any> {
  return withTransientRetry(() => model.generateContent(contents), {
    modelId,
    enablePacing: true,
    logPrefix: '[gemini]',
  });
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

export async function transcribeWithGemini(
  filePath: string,
  apiKey: string,
  modelId: string = 'gemini-2.0-flash',
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
      
      // If it's a local file error, don't try other models
      if (errMsg.includes('Audio file not found') || errMsg.includes('is empty (0 bytes)')) {
        break;
      }
    }
  }

  throw lastError || new Error('Transcription failed with all models.');
}

async function transcribeWithGeminiInternal(
  filePath: string,
  apiKey: string,
  modelId: string = 'gemini-2.0-flash',
  timeOffset: number = 0
): Promise<ChunkResult> {
  const genAI = createGenAIClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 32768,
    },
  });

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

      result = await generateContentWithRetry(model, [prompt, filePart], modelId);
    } else {
      console.log(`[gemini] File size ${fileStats.size} bytes is < 5MB. Transcribing inline...`);
      const audioData = fs.readFileSync(filePath);
      const audioPart = {
        inlineData: {
          data: audioData.toString('base64'),
          mimeType,
        },
      };

      result = await generateContentWithRetry(model, [prompt, audioPart], modelId);
    }

    const response = result.response;
    const text = response.text();

    console.log(`[gemini] API response length: ${text.length} chars`);

    let segments = parseTranscriptionResponse(text);

    // A non-empty response that produced no segments means the model returned
    // unparseable/truncated JSON (or an error in prose). Retry rather than
    // silently losing this chunk's content. A response of "[]" is a valid
    // (silent) transcription and is kept.
    const meaningfulResponse = text.replace(/[\s\[\]]/g, '');
    if (segments.length === 0 && meaningfulResponse.length > 0) {
      throw new Error(`Gemini returned an unparseable response (${text.substring(0, 120)}). Retrying...`);
    }

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
      model: modelId,
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
      
      // If it's a local file error, don't try other models
      if (errMsg.includes('Chunk file not found') || errMsg.includes('is empty (0 bytes)')) {
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
  const model = genAI.getGenerativeModel({
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

      result = await generateContentWithRetry(model, [GEMINI_CHUNK_PROMPT, filePart], modelId);
    } else {
      console.log(`[gemini] Chunk ${chunkIndex} size ${fileStats.size} bytes is < 5MB. Transcribing inline...`);
      const audioData = fs.readFileSync(filePath);
      const audioPart = {
        inlineData: {
          data: audioData.toString('base64'),
          mimeType,
        },
      };

      result = await generateContentWithRetry(model, [GEMINI_CHUNK_PROMPT, audioPart], modelId);
    }

    const response = result.response;
    const text = response.text();

    console.log(`[gemini] Chunk ${chunkIndex} response length: ${text.length} chars`);

    let segments = parseTranscriptionResponse(text);

    // A non-empty response that produced no segments means the model returned
    // unparseable/truncated JSON (or an error in prose). Retry rather than
    // silently losing this chunk's content. A response of "[]" is a valid
    // (silent) transcription and is kept.
    const meaningfulResponse = text.replace(/[\s\[\]]/g, '');
    if (segments.length === 0 && meaningfulResponse.length > 0) {
      throw new Error(`Gemini returned an unparseable response for chunk ${chunkIndex} (${text.substring(0, 120)}). Retrying...`);
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
      rawText: text,
      model: modelId,
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

export async function testGeminiConnection(apiKey: string, modelId: string = 'gemini-2.0-flash'): Promise<boolean> {
  try {
    const genAI = createGenAIClient(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent('Say "OK" if you can hear me.');
    return !!result.response.text();
  } catch {
    return false;
  }
}
