import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitAudioIntoChunks, getAudioDuration } from '@/lib/audio/slicer';
import { mergeChunkResults } from '@/lib/transcriber/merger';
import { formatTime } from '@/lib/format-utils';
import { transcribeChunkWithGemini } from '@/lib/transcriber/gemini';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';
import type { TranscriptionResult, ChunkResult } from '@/lib/transcriber/types';
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
    const chunkDuration = parseInt(formData.get('chunkDuration') as string) || 300; // 5 mins
    const overlapDuration = parseInt(formData.get('overlapDuration') as string) || 30; // 30s overlap

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

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key is required for transcription' }, { status: 400 });
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
  chunkDuration: number;
  overlapDuration: number;
  duration: number | null;
}

async function processTranscriptionJob(params: TranscriptionJobParams) {
  const { jobId, filePath, tempDir, modelInfo, modelId, geminiApiKey, chunkDuration, overlapDuration, duration } = params;

  try {
    let chunks;
    try {
      chunks = await splitAudioIntoChunks(filePath, { chunkDuration, overlapDuration });
    } catch (chunkErr) {
      console.error('[transcribe] Chunking failed, using whole file as fallback:', chunkErr);
      chunks = [{
        index: 0,
        filePath,
        startTime: 0,
        duration: duration ?? 0,
        coreStartTime: 0,
        coreEndTime: duration ?? 0,
        hasStartOverlap: false,
        hasEndOverlap: false,
      }];
    }

    console.log(`[transcribe] Split into ${chunks.length} chunk(s) (${chunkDuration}s chunks with ${overlapDuration}s overlaps)`);

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        chunksTotal: chunks.length,
      },
    });

    const completedChunkResults: { chunk: typeof chunks[0]; result: ChunkResult }[] = [];
    const failedChunks: typeof chunks = [];
    let chunksDone = 0;
    let fallbackUsed = false;
    // Once a fallback model proves to work (e.g. the primary is quota-limited),
    // prefer it for the remaining chunks instead of retrying the dead one.
    let activeModel = modelId;

    for (const chunk of chunks) {
      let result: ChunkResult | null = null;
      let chunkAttempts = 0;
      const maxChunkAttempts = 3;

      while (chunkAttempts < maxChunkAttempts && !result) {
        chunkAttempts++;
        try {
          result = await transcribeChunkWithGemini(chunk.filePath, geminiApiKey, activeModel, chunk.index, chunk.startTime);
        } catch (chunkErr) {
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.warn(`[transcribe] Chunk ${chunk.index} attempt ${chunkAttempts}/${maxChunkAttempts} failed: ${errMsg}`);
          if (chunkAttempts < maxChunkAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            console.error(`[transcribe] Chunk ${chunk.index} failed all ${maxChunkAttempts} attempts.`);
          }
        }
      }

      if (result) {
        console.log(`[transcribe] Chunk ${chunk.index}: ${result.segments.length} segments`);
        completedChunkResults.push({ chunk, result });
        if (result.model) activeModel = result.model;
        if (result.fallbackUsed) {
          fallbackUsed = true;
        }
      } else {
        failedChunks.push(chunk);
      }

      chunksDone++;
      await db.transcriptionJob.update({
        where: { id: jobId },
        data: {
          chunksDone,
          progress: Math.round((chunksDone / chunks.length) * 100),
          chunkResults: JSON.stringify(completedChunkResults.map(c => c.result)),
        },
      });
    }

    // Second-chance pass: a chunk may have failed because a per-minute quota
    // was momentarily exhausted. Wait once, then retry the failed chunks.
    if (failedChunks.length > 0) {
      console.warn(`[transcribe] ${failedChunks.length} chunk(s) failed. Waiting 20s, then retrying them...`);
      await new Promise(resolve => setTimeout(resolve, 20000));
      for (const chunk of [...failedChunks]) {
        try {
          const result = await transcribeChunkWithGemini(chunk.filePath, geminiApiKey, activeModel, chunk.index, chunk.startTime);
          console.log(`[transcribe] Chunk ${chunk.index} recovered on retry: ${result.segments.length} segments`);
          completedChunkResults.push({ chunk, result });
          if (result.model) activeModel = result.model;
          if (result.fallbackUsed) fallbackUsed = true;
          failedChunks.splice(failedChunks.indexOf(chunk), 1);
        } catch (retryErr) {
          console.error(`[transcribe] Chunk ${chunk.index} still failed on retry:`, retryErr);
        }
      }
    }

    const skippedChunks = failedChunks.map(c => c.index);
    if (skippedChunks.length > 0) {
      console.warn(`[transcribe] Skipping chunks [${skippedChunks.join(', ')}] (${skippedChunks.length}/${chunks.length}) — content from these may be missing.`);
    }

    if (completedChunkResults.length === 0) {
      throw new Error('Transcription produced no results. All chunk attempts failed. Please check network connection and API keys.');
    }

    // Merge and deduplicate overlapping speech across chunk boundaries
    const merged = mergeChunkResults(completedChunkResults);
    const fullText = merged.map(s => `[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`).join('\n');
    const totalDuration = merged.length > 0 ? Math.max(...merged.map(s => s.endTime)) : (duration ?? 0);

    const result: TranscriptionResult = {
      segments: merged,
      fullText,
      duration: totalDuration,
      language: 'bn',
      model: modelId,
      fallbackUsed,
      skippedChunks: skippedChunks.length > 0 ? skippedChunks : undefined,
    };

    await db.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        chunksDone: chunks.length,
        chunksTotal: chunks.length,
        result: JSON.stringify(result),
        chunkResults: JSON.stringify(completedChunkResults.map(c => c.result)),
        duration: totalDuration,
      },
    });

    console.log(`[transcribe] Job ${jobId} completed. ${merged.length} segments total after overlap deduplication. Fallback used: ${fallbackUsed}. Skipped: ${skippedChunks.length}`);
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
