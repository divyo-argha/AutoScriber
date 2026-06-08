import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitAudioIntoChunks, getAudioDuration, formatTime } from '@/lib/transcriber/chunker';
import { transcribeChunkWithGemini } from '@/lib/transcriber/gemini';
import { transcribeChunkWithSoniox } from '@/lib/transcriber/soniox';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';
import type { TranscriptionSegment, TranscriptionResult } from '@/lib/transcriber/types';
import { classifyGeminiError } from '@/lib/transcriber/error-utils';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 300;

// Directory for persistent audio storage
const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'data', 'audio');

function ensureAudioStorageDir() {
  if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
    fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelId = (formData.get('model') as string) || 'gemini-2.5-flash';

    const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    const geminiApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    const sonioxApiKey = (settings as any)?.sonioxApiKey || process.env.SONIOX_API_KEY || '';
    const chunkDuration = parseInt(formData.get('chunkDuration') as string) || 300;
    const overlapDuration = parseInt(formData.get('overlapDuration') as string) || 10;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({
        error: 'The uploaded file is empty (0 bytes). Please ensure the audio was recorded properly and try again.',
      }, { status: 400 });
    }

    const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!modelInfo) {
      return NextResponse.json({ error: 'Invalid model selected' }, { status: 400 });
    }

    if (modelInfo.provider === 'gemini' && !geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key is required for cloud transcription' }, { status: 400 });
    }
    if (modelInfo.provider === 'soniox' && !sonioxApiKey) {
      return NextResponse.json({ error: 'Soniox API key is required. Add it in Settings.' }, { status: 400 });
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-upload-'));
    const filePath = path.join(tempDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const savedStats = fs.statSync(filePath);
    if (savedStats.size === 0) {
      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}
      return NextResponse.json({
        error: 'The uploaded file is empty after saving. The recording may have failed — please try recording again.',
      }, { status: 400 });
    }

    console.log(`[transcribe] File saved: ${file.name}, size: ${savedStats.size} bytes`);

    ensureAudioStorageDir();
    const persistentAudioPath = path.join(AUDIO_STORAGE_DIR, `${Date.now()}_${file.name}`);
    try {
      fs.copyFileSync(filePath, persistentAudioPath);
      console.log(`[transcribe] Audio saved to persistent storage: ${persistentAudioPath}`);
    } catch (err) {
      console.error('[transcribe] Failed to save audio to persistent storage:', err);
    }

    let duration: number | null = null;
    try {
      const dur = await getAudioDuration(filePath);
      duration = typeof dur === 'number' && isFinite(dur) && dur > 0 ? dur : null;
      console.log(`[transcribe] Audio duration from ffprobe: ${duration}`);
    } catch (err) {
      console.error('[transcribe] Failed to get audio duration:', err);
    }

    const job = await db.transcriptionJob.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        duration,
        status: 'chunking',
        model: modelId,
        progress: 0,
        chunksTotal: 0,
        chunksDone: 0,
        audioPath: persistentAudioPath,
      },
    });

    void processTranscriptionJob({
      jobId: job.id,
      filePath,
      tempDir,
      modelInfo,
      modelId,
      geminiApiKey,
      sonioxApiKey,
      chunkDuration,
      overlapDuration,
      duration,
    });

    return NextResponse.json({ jobId: job.id, status: 'started' });
  } catch (err) {
    console.error('[transcribe] Top-level error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

interface TranscriptionJobParams {
  jobId: string;
  filePath: string;
  tempDir: string;
  modelInfo: typeof AVAILABLE_MODELS[number];
  modelId: string;
  geminiApiKey: string;
  sonioxApiKey: string;
  chunkDuration: number;
  overlapDuration: number;
  duration: number | null;
}

async function processTranscriptionJob(params: TranscriptionJobParams) {
  const { jobId, filePath, tempDir, modelInfo, modelId, geminiApiKey, sonioxApiKey, chunkDuration, overlapDuration, duration } = params;

  try {
    const effectiveChunkDuration = chunkDuration;

    let chunks;
    try {
      chunks = await splitAudioIntoChunks(filePath, effectiveChunkDuration, overlapDuration);
    } catch (chunkErr) {
      console.error('[transcribe] Chunking failed, using whole file as fallback:', chunkErr);
      chunks = [{ index: 0, filePath, startTime: 0, duration: duration ?? 0 }];
    }

    console.log(`[transcribe] Split into ${chunks.length} chunk(s)`);

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        chunksTotal: chunks.length,
      },
    });

    const allSegments: TranscriptionSegment[] = [];
    let chunksDone = 0;
    let fallbackUsed = false;

    for (const chunk of chunks) {
      try {
        const result = modelInfo.provider === 'soniox'
          ? await transcribeChunkWithSoniox(chunk.filePath, sonioxApiKey, modelId, chunk.index, chunk.startTime)
          : await transcribeChunkWithGemini(chunk.filePath, geminiApiKey, modelId, chunk.index, chunk.startTime, sonioxApiKey);

        console.log(`[transcribe] Chunk ${chunk.index}: ${result.segments.length} segments`);
        allSegments.push(...result.segments);
        if (result.fallbackUsed) {
          fallbackUsed = true;
        }

        chunksDone++;
        await db.transcriptionJob.update({
          where: { id: jobId },
          data: {
            chunksDone,
            progress: Math.round((chunksDone / chunks.length) * 100),
          },
        });
      } catch (chunkErr) {
        const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
        console.error(`[transcribe] Error processing chunk ${chunk.index}:`, errMsg);
        // Rethrow so the outer catch handles job failure
        throw chunkErr;
      }
    }

    // Merge, deduplicate overlap regions, and sort all segments
    const merged = mergeAndDeduplicateSegments(allSegments, overlapDuration);
    const fullText = merged.map(s => `[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`).join('\n');
    const totalDuration = merged.length > 0 ? Math.max(...merged.map(s => s.endTime)) : (duration ?? 0);

    const result: TranscriptionResult = {
      segments: merged,
      fullText,
      duration: totalDuration,
      language: 'bn',
      model: modelId,
      fallbackUsed,
    };

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        chunksDone: chunks.length,
        chunksTotal: chunks.length,
        result: JSON.stringify(result),
        duration: totalDuration,
      },
    });

    console.log(`[transcribe] Job ${jobId} completed. ${merged.length} segments total. Fallback used: ${fallbackUsed}`);
  } catch (processErr) {
    const classified = classifyGeminiError(processErr);
    const errorMessage = classified.isLocationError
      ? `${classified.message} ${classified.suggestion}`
      : processErr instanceof Error ? processErr.message : 'Unknown error';

    console.error('[transcribe] Processing error:', errorMessage);

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage,
      },
    });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
    try { fs.rmdirSync(tempDir); } catch {}
  }
}

/**
 * Sort, remove duplicate segments from chunk overlap boundaries,
 * and merge adjacent same-speaker segments.
 */
function mergeAndDeduplicateSegments(
  segments: TranscriptionSegment[],
  overlapDuration: number
): TranscriptionSegment[] {
  if (segments.length === 0) return [];

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  // Deduplicate segments that are near-identical (within overlap window)
  // Keep the segment with the more accurate (earlier) startTime
  const deduped: TranscriptionSegment[] = [];
  for (const seg of sorted) {
    const isDuplicate = deduped.some(existing => {
      const timeDiff = Math.abs(existing.startTime - seg.startTime);
      const textMatch = existing.text.trim().toLowerCase() === seg.text.trim().toLowerCase();
      return timeDiff < Math.max(overlapDuration, 3) && textMatch;
    });
    if (!isDuplicate) {
      deduped.push(seg);
    }
  }

  // Merge consecutive same-speaker segments with small gaps (< 2s)
  const merged: TranscriptionSegment[] = [];
  let current = { ...deduped[0] };

  for (let i = 1; i < deduped.length; i++) {
    const seg = deduped[i];
    if (
      current.speaker === seg.speaker &&
      seg.startTime - current.endTime < 2
    ) {
      current.endTime = Math.max(current.endTime, seg.endTime);
      current.text = current.text + ' ' + seg.text;
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);
  return merged;
}
