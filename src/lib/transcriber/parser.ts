import path from 'path';
import type { TranscriptionSegment } from './types';

export function getMimeType(filePath: string): string {
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

export function parseTranscriptionResponse(text: string): TranscriptionSegment[] {
  let jsonStr = text.trim();

  if (!jsonStr) return [];

  // Remove markdown code fences
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Locate the JSON array span (ignore any surrounding commentary)
  const startIdx = jsonStr.indexOf('[');
  if (startIdx === -1) {
    console.error('[transcriber] No JSON array found in response');
    return [];
  }
  const endIdx = jsonStr.lastIndexOf(']');
  jsonStr = endIdx === -1 ? jsonStr.slice(startIdx) : jsonStr.slice(startIdx, endIdx + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    parsed = salvageParseArray(jsonStr);
    if (!parsed) {
      console.error('[transcriber] JSON parse failed:', parseErr);
      console.error('[transcriber] Attempted to parse:', jsonStr.substring(0, 200));
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    console.error('[transcriber] Response is not an array');
    return [];
  }

  return (parsed as Record<string, unknown>[])
    .filter(seg => seg && typeof seg === 'object')
    .map((seg: Record<string, unknown>) => ({
      speaker: String(seg.speaker || 'Speaker Unknown'),
      startTime: Number(seg.startTime) || 0,
      endTime: Number(seg.endTime) || 0,
      text: String(seg.text || ''),
    }))
    .filter(seg => seg.text.trim().length > 0);
}

/**
 * Salvage a truncated or slightly malformed JSON array: fix trailing commas
 * and progressively drop incomplete trailing objects until the JSON parses.
 */
function salvageParseArray(jsonStr: string): unknown[] | null {
  let candidate = jsonStr.replace(/,\s*$/, '');
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!candidate.trim().endsWith(']')) {
      candidate = candidate.trim().replace(/,\s*$/, '') + ']';
    }
    candidate = candidate.replace(/,\s*\]$/, ']');
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      // Drop the last object and retry
      const lastBrace = candidate.lastIndexOf('}');
      if (lastBrace === -1) return null;
      candidate = candidate.slice(0, lastBrace + 1).replace(/,\s*$/, '');
    }
  }
  return null;
}
