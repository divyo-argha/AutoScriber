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
  // Try to extract JSON from the response
  let jsonStr = text.trim();

  // Remove markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON array in the text
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((seg: Record<string, unknown>) => ({
        speaker: String(seg.speaker || 'Speaker Unknown'),
        startTime: Number(seg.startTime || 0),
        endTime: Number(seg.endTime || 0),
        text: String(seg.text || ''),
      }));
    }
  } catch (parseErr) {
    console.error('[gemini] Failed to parse JSON response:', parseErr);
    console.error('[gemini] Raw response text (first 500 chars):', text.substring(0, 500));
    // If JSON parsing fails, create a single segment from the raw text
    if (text.trim()) {
      return [{
        speaker: 'Speaker Unknown',
        startTime: 0,
        endTime: 0,
        text: text.trim(),
      }];
    }
  }

  return [];
}

export async function transcribeWithGemini(
  filePath: string,
  apiKey: string,
  modelId: string = 'gemini-2.5-flash',
  timeOffset: number = 0
): Promise<ChunkResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  // Validate file exists and has content
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

  // Apply time offset for chunks
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
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  // Validate file exists and has content
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

  // Apply time offset for chunks
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent('Say "OK" if you can hear me.');
    return !!result.response.text();
  } catch {
    return false;
  }
}
