import { OLLAMA_TRANSCRIPTION_PROMPT } from './types';
import type { TranscriptionSegment, ChunkResult } from './types';
import fs from 'fs';

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
      return [];
    }
  } else {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(seg => seg && typeof seg === 'object')
      .map((seg: Record<string, unknown>) => ({
        speaker: String(seg.speaker || 'Speaker Unknown'),
        startTime: Number(seg.startTime) || 0,
        endTime: Number(seg.endTime) || 0,
        text: String(seg.text || ''),
      }))
      .filter(seg => seg.text.trim().length > 0);
  } catch {
    return [];
  }
}

export async function transcribeWithOllama(
  filePath: string,
  modelId: string,
  ollamaUrl: string = 'http://localhost:11434',
  timeOffset: number = 0
): Promise<ChunkResult> {
  const audioData = fs.readFileSync(filePath);
  const base64Audio = audioData.toString('base64');
  
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      prompt: OLLAMA_TRANSCRIPTION_PROMPT,
      images: [base64Audio], // Ollama uses 'images' field for multimodal data including audio
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 8192,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.response || '';
  
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

export async function transcribeChunkWithOllama(
  filePath: string,
  modelId: string,
  ollamaUrl: string,
  chunkIndex: number,
  timeOffset: number
): Promise<ChunkResult> {
  const result = await transcribeWithOllama(filePath, modelId, ollamaUrl, timeOffset);
  result.chunkIndex = chunkIndex;
  return result;
}

export async function listOllamaModels(ollamaUrl: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function testOllamaConnection(ollamaUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
