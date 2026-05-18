import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_TRANSCRIPTION_PROMPT, GEMINI_CHUNK_PROMPT } from './types';
import type { TranscriptionSegment, ChunkResult } from './types';
import fs from 'fs';
import path from 'path';

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

export async function transcribeWithGemini(
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

  const audioData = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  console.log(`[gemini] Transcribing file: ${path.basename(filePath)}, size: ${audioData.length} bytes, mime: ${mimeType}`);

  const audioPart = {
    inlineData: {
      data: audioData.toString('base64'),
      mimeType,
    },
  };

  const prompt = timeOffset > 0 ? GEMINI_CHUNK_PROMPT : GEMINI_TRANSCRIPTION_PROMPT;

  const result = await model.generateContent([prompt, audioPart]);
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
}

export async function transcribeChunkWithGemini(
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

  const audioData = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  console.log(`[gemini] Transcribing chunk ${chunkIndex}: ${path.basename(filePath)}, size: ${audioData.length} bytes, mime: ${mimeType}`);

  const audioPart = {
    inlineData: {
      data: audioData.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([GEMINI_CHUNK_PROMPT, audioPart]);
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
