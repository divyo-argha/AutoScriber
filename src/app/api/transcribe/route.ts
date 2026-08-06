import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitAudioIntoChunks, getAudioDuration, cleanupChunks } from '@/lib/audio/slicer';
import { mergeChunkResults } from '@/lib/transcriber/merger';
import { formatTime } from '@/lib/format-utils';
import { transcribeChunk } from '@/lib/transcriber';
import { getGcpCredentialsInfo } from '@/lib/transcriber/gcp-credentials';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';
import type { TranscriptionResult, ChunkResult } from '@/lib/transcriber/types';
import type { ChunkInfo } from '@/lib/audio/types';
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
    const modelId = (formData.get('model') as string) || 'gemini-2.0-flash';

    const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    const geminiApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    const gcpCreds = getGcpCredentialsInfo(settings?.gcpCredentialsPath, settings?.gcpLocation);
    const hasGcpCreds = gcpCreds.exists || !!settings?.gcpProjectId || !!process.env.GCP_PROJECT_ID;
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

    if (!geminiApiKey && !hasGcpCreds) {
      return NextResponse.json({ error: 'Gemini API key or GCP Vertex credentials (gcp-credentials.json) are required for transcription' }, { status: 400 });
    }

    // Sanitize the client-supplied filename to prevent path traversal when it
    // is joined into local temp & persistent storage paths.
    const safeFileName = path.basename(file.name).replace(/[^\w.\-() ]/g, '_');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-upload-'));
    const filePath = path.join(tempDir, safeFileName);
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
    const persistentAudioPath = path.join(AUDIO_STORAGE_DIR, `${Date.now()}_${safeFileName}`);
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
      audioPath: persistentAudioPath,
      aiProvider: settings?.aiProvider || 'auto',
      gcpProjectId: settings?.gcpProjectId,
      gcpLocation: settings?.gcpLocation,
      gcpCredentialsPath: settings?.gcpCredentialsPath,
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
  audioPath: string | null;
  aiProvider?: string;
  gcpProjectId?: string;
  gcpLocation?: string;
  gcpCredentialsPath?: string;
}

const CONTROL_POLL_INTERVAL = 3000;

async function getJobControlStatus(jobId: string): Promise<string> {
  try {
    const job = await db.transcriptionJob.findUnique({
      where: { id: jobId },
      select: { controlStatus: true },
    });
    return job?.controlStatus || 'running';
  } catch {
    return 'running';
  }
}

function isCancelRequested(controlStatus: string): boolean {
  return controlStatus === 'cancel_requested' || controlStatus === 'cancelled';
}

/**
 * Blocks while the job is paused. Resolves 'running' once resumed or
 * 'cancelled' if the user cancels while paused.
 */
async function waitWhilePaused(jobId: string): Promise<'running' | 'cancelled'> {
  for (;;) {
    const control = await getJobControlStatus(jobId);
    if (control === 'running') return 'running';
    if (isCancelRequested(control)) return 'cancelled';
    await new Promise(resolve => setTimeout(resolve, CONTROL_POLL_INTERVAL));
  }
}

/**
 * Sleep that aborts early when the job is paused or cancelled, so the UI
 * controls stay responsive. Returns 'running' if the sleep completed.
 */
async function sleepWithControl(jobId: string, ms: number): Promise<'running' | 'cancelled'> {
  const step = CONTROL_POLL_INTERVAL;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    const control = await getJobControlStatus(jobId);
    if (isCancelRequested(control)) return 'cancelled';
    if (control === 'paused') {
      const resumed = await waitWhilePaused(jobId);
      if (resumed === 'cancelled') return 'cancelled';
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(step, ms - elapsed)));
  }
  return 'running';
}

/** Mark the job cancelled and delete its persisted audio file. */
async function cancelJob(jobId: string, audioPath: string | null) {
  try {
    await db.transcriptionJob.update({
      where: { id: jobId },
      data: { status: 'cancelled', controlStatus: 'cancelled' },
    });
  } catch (err) {
    console.error('[transcribe] Failed to mark job cancelled:', err);
  }
  if (audioPath) {
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      console.log(`[transcribe] Deleted audio for cancelled job: ${audioPath}`);
    } catch (err) {
      console.error('[transcribe] Failed to delete cancelled job audio:', err);
    }
  }
}

async function processTranscriptionJob(params: TranscriptionJobParams) {
  const {
    jobId,
    filePath,
    tempDir,
    modelInfo,
    modelId,
    geminiApiKey,
    chunkDuration,
    overlapDuration,
    duration,
    audioPath,
    aiProvider = 'auto',
    gcpProjectId,
    gcpLocation,
    gcpCredentialsPath,
  } = params;
  let chunks: ChunkInfo[] = [];

  try {
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
      // Respect pause/resume/cancel between chunks
      const control = await getJobControlStatus(jobId);
      if (isCancelRequested(control)) {
        console.log(`[transcribe] Job ${jobId} cancelled by user before chunk ${chunk.index}.`);
        await cancelJob(jobId, audioPath);
        return;
      }
      if (control === 'paused') {
        console.log(`[transcribe] Job ${jobId} paused before chunk ${chunk.index}. Waiting for resume...`);
        const resumed = await waitWhilePaused(jobId);
        if (resumed === 'cancelled') {
          console.log(`[transcribe] Job ${jobId} cancelled while paused.`);
          await cancelJob(jobId, audioPath);
          return;
        }
      }

      let result: ChunkResult | null = null;
      let chunkAttempts = 0;
      const maxChunkAttempts = 2;

      while (chunkAttempts < maxChunkAttempts && !result) {
        // Cancel takes priority over retrying a failing chunk
        if (isCancelRequested(await getJobControlStatus(jobId))) {
          console.log(`[transcribe] Job ${jobId} cancelled during chunk ${chunk.index} attempts.`);
          await cancelJob(jobId, audioPath);
          return;
        }
        chunkAttempts++;
        try {
          result = await transcribeChunk({
            filePath: chunk.filePath,
            modelId: activeModel,
            chunkIndex: chunk.index,
            timeOffset: chunk.startTime,
            aiProvider,
            geminiApiKey,
            gcpProjectId,
            gcpLocation,
            gcpCredentialsPath,
          });
        } catch (chunkErr) {
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.warn(`[transcribe] Chunk ${chunk.index} attempt ${chunkAttempts}/${maxChunkAttempts} failed: ${errMsg}`);
          if (chunkAttempts < maxChunkAttempts) {
            const waited = await sleepWithControl(jobId, 2000);
            if (waited === 'cancelled') {
              console.log(`[transcribe] Job ${jobId} cancelled while waiting between chunk attempts.`);
              await cancelJob(jobId, audioPath);
              return;
            }
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
          progress: Math.min(98, Math.round((chunksDone / chunks.length) * 100)),
          chunkResults: JSON.stringify(completedChunkResults.map(c => c.result)),
        },
      });
    }

    // Second-chance pass: if any chunk failed, wait briefly (5s) then retry once.
    if (failedChunks.length > 0) {
      console.warn(`[transcribe] ${failedChunks.length} chunk(s) failed. Waiting 5s, then retrying them...`);
      const waited = await sleepWithControl(jobId, 5000);
      if (waited === 'cancelled') {
        console.log(`[transcribe] Job ${jobId} cancelled during retry wait.`);
        await cancelJob(jobId, audioPath);
        return;
      }
      for (const chunk of [...failedChunks]) {
        if (isCancelRequested(await getJobControlStatus(jobId))) {
          console.log(`[transcribe] Job ${jobId} cancelled during retry pass.`);
          await cancelJob(jobId, audioPath);
          return;
        }
        try {
          const result = await transcribeChunk({
            filePath: chunk.filePath,
            modelId: activeModel,
            chunkIndex: chunk.index,
            timeOffset: chunk.startTime,
            aiProvider,
            geminiApiKey,
            gcpProjectId,
            gcpLocation,
            gcpCredentialsPath,
          });
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

    // Final cancel check before assembling the result
    if (isCancelRequested(await getJobControlStatus(jobId))) {
      console.log(`[transcribe] Job ${jobId} cancelled before final assembly.`);
      await cancelJob(jobId, audioPath);
      return;
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
    // Clean up the FFmpeg chunk files (they live in their own temp dir)
    try { cleanupChunks(chunks); } catch {}
    try { fs.unlinkSync(filePath); } catch {}
    try { fs.rmdirSync(tempDir); } catch {}
  }
}
