import { db } from '@/lib/db';
import { splitAudioIntoChunks, cleanupChunks } from '@/lib/audio/slicer';
import { mergeChunkResults } from '@/lib/transcriber/merger';
import { formatTime } from '@/lib/format-utils';
import { transcribeChunk } from '@/lib/transcriber';
import { classifyGeminiError } from '@/lib/transcriber/error-utils';
import type { TranscriptionResult, ChunkResult, ModelInfo } from '@/lib/transcriber/types';
import type { ChunkInfo } from '@/lib/audio/types';
import {
  getJobControlStatus,
  isCancelRequested,
  waitWhilePaused,
  sleepWithControl,
  cancelJob,
} from './control';
import fs from 'fs';

export interface TranscriptionJobParams {
  jobId: string;
  filePath: string;
  tempDir: string;
  modelInfo: ModelInfo;
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
  gcpCredentialsJson?: string | null;
}

const MAX_CHUNK_ATTEMPTS = 3;
const RETRY_WAIT_MS = 2000;
const SECOND_PASS_WAIT_MS = 5000;

/**
 * Orchestrates a single transcription job in the background: chunking the
 * audio, transcribing each chunk (with retries and model fallback), a
 * second-chance retry pass, overlap deduplication, and finally persisting the
 * merged result. Respects pause/resume/cancel at every boundary.
 */
export async function processTranscriptionJob(params: TranscriptionJobParams) {
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
    gcpCredentialsJson,
  } = params;
  let chunks: ChunkInfo[] = [];

  const transcribe = (chunk: ChunkInfo, activeModel: string) =>
    transcribeChunk({
      filePath: chunk.filePath,
      modelId: activeModel,
      chunkIndex: chunk.index,
      timeOffset: chunk.startTime,
      aiProvider,
      geminiApiKey,
      gcpProjectId,
      gcpLocation,
      gcpCredentialsPath,
      gcpCredentialsJson,
    });

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

      while (chunkAttempts < MAX_CHUNK_ATTEMPTS && !result) {
        if (isCancelRequested(await getJobControlStatus(jobId))) {
          console.log(`[transcribe] Job ${jobId} cancelled during chunk ${chunk.index} attempts.`);
          await cancelJob(jobId, audioPath);
          return;
        }
        chunkAttempts++;
        try {
          result = await transcribe(chunk, activeModel);
        } catch (chunkErr) {
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.warn(`[transcribe] Chunk ${chunk.index} attempt ${chunkAttempts}/${MAX_CHUNK_ATTEMPTS} failed: ${errMsg}`);
          if (chunkAttempts < MAX_CHUNK_ATTEMPTS) {
            const waited = await sleepWithControl(jobId, RETRY_WAIT_MS);
            if (waited === 'cancelled') {
              console.log(`[transcribe] Job ${jobId} cancelled while waiting between chunk attempts.`);
              await cancelJob(jobId, audioPath);
              return;
            }
          } else {
            console.error(`[transcribe] Chunk ${chunk.index} failed all ${MAX_CHUNK_ATTEMPTS} attempts.`);
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

    // Second-chance pass: if any chunk failed, wait briefly then retry once.
    if (failedChunks.length > 0) {
      console.warn(`[transcribe] ${failedChunks.length} chunk(s) failed. Waiting ${SECOND_PASS_WAIT_MS / 1000}s, then retrying them...`);
      const waited = await sleepWithControl(jobId, SECOND_PASS_WAIT_MS);
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
          const result = await transcribe(chunk, activeModel);
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

    if (isCancelRequested(await getJobControlStatus(jobId))) {
      console.log(`[transcribe] Job ${jobId} cancelled before final assembly.`);
      await cancelJob(jobId, audioPath);
      return;
    }

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

    console.error('[transcribe] Processing error (raw):', classified.raw);

    const errorMessage = classified.suggestion
      ? `${classified.message} ${classified.suggestion}`
      : classified.message;

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
