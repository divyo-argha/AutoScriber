import { db } from '@/lib/db';
import { splitAudioIntoChunks, cleanupChunks } from '@/lib/audio/slicer';
import { mergeChunkResults } from '@/lib/transcriber/merger';
import { formatTime } from '@/lib/format-utils';
import { transcribeChunk } from '@/lib/transcriber';
import { classifyGeminiError, isQuotaError } from '@/lib/transcriber/error-utils';
import { isHardQuotaError } from '@/lib/transcriber/retry';
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
    let fallbackUsed = false;
    let activeModel = modelId;

    // Resume from existing progress if available
    const dbJobInit = await db.transcriptionJob.findUnique({
      where: { id: jobId },
      select: { chunkResults: true },
    });
    if (dbJobInit?.chunkResults) {
      try {
        const parsed = JSON.parse(dbJobInit.chunkResults) as ChunkResult[];
        if (Array.isArray(parsed)) {
          console.log(`[transcribe] Found ${parsed.length} already completed chunks. Restoring progress...`);
          for (const res of parsed) {
            const matchingChunk = chunks.find(c => c.index === res.chunkIndex);
            if (matchingChunk) {
              completedChunkResults.push({ chunk: matchingChunk, result: res });
            }
          }
        }
      } catch (err) {
        console.error('[transcribe] Failed to parse existing chunkResults:', err);
      }
    }

    let chunksDone = 0;

    for (const chunk of chunks) {
      const alreadyCompleted = completedChunkResults.find(c => c.chunk.index === chunk.index);
      if (alreadyCompleted) {
        console.log(`[transcribe] Chunk ${chunk.index} already completed. Skipping.`);
        if (alreadyCompleted.result.model) activeModel = alreadyCompleted.result.model;
        if (alreadyCompleted.result.fallbackUsed) fallbackUsed = true;
        chunksDone++;
        continue;
      }

      let result: ChunkResult | null = null;
      let chunkAttempts = 0;
      const baseMaxAttempts = MAX_CHUNK_ATTEMPTS;
      const rateLimitMaxAttempts = 15;

      while (!result) {
        const control = await getJobControlStatus(jobId);
        if (isCancelRequested(control)) {
          console.log(`[transcribe] Job ${jobId} cancelled by user during chunk ${chunk.index}.`);
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
          // Reset attempts count when resuming
          chunkAttempts = 0;
        }

        // Fetch latest settings & model choice from DB
        const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
        const currentApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
        const currentGcpJson = settings?.gcpCredentialsJson || '';

        const dbJob = await db.transcriptionJob.findUnique({
          where: { id: jobId },
          select: { model: true },
        });
        if (dbJob?.model) {
          activeModel = dbJob.model;
        }

        chunkAttempts++;
        try {
          result = await transcribeChunk({
            filePath: chunk.filePath,
            modelId: activeModel,
            chunkIndex: chunk.index,
            timeOffset: chunk.startTime,
            aiProvider: settings?.aiProvider || 'auto',
            geminiApiKey: currentApiKey,
            gcpProjectId: settings?.gcpProjectId,
            gcpLocation: settings?.gcpLocation,
            gcpCredentialsPath: settings?.gcpCredentialsPath,
            gcpCredentialsJson: currentGcpJson || null,
          });
        } catch (chunkErr) {
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          const isHardQuota = isHardQuotaError(chunkErr);
          const isRateLimit = isQuotaError(chunkErr) || errMsg.includes('429');

          if (isHardQuota) {
            console.warn(`[transcribe] Chunk ${chunk.index} failed: Daily quota limit reached.`);
            // Pause the job and ask user to change key/model
            await db.transcriptionJob.update({
              where: { id: jobId },
              data: {
                controlStatus: 'paused',
                errorMessage: 'Daily quota limit reached. Please switch model or update API key in Settings, then Resume.',
              },
            });
            // Reset attempts so when they resume we try this chunk fresh
            chunkAttempts = 0;
            continue;
          }

          if (isRateLimit) {
            const maxLimit = rateLimitMaxAttempts;
            console.warn(`[transcribe] Chunk ${chunk.index} rate limited (attempt ${chunkAttempts}/${maxLimit}). Waiting 30s...`);
            if (chunkAttempts < maxLimit) {
              const waited = await sleepWithControl(jobId, 30000); // Wait 30 seconds
              if (waited === 'cancelled') {
                console.log(`[transcribe] Job ${jobId} cancelled during rate-limit sleep.`);
                await cancelJob(jobId, audioPath);
                return;
              }
            } else {
              console.error(`[transcribe] Chunk ${chunk.index} failed after ${maxLimit} rate-limit attempts.`);
              throw chunkErr;
            }
          } else {
            // Other errors (e.g. transient 5xx, or network)
            const maxLimit = baseMaxAttempts;
            console.warn(`[transcribe] Chunk ${chunk.index} attempt ${chunkAttempts}/${maxLimit} failed: ${errMsg}`);
            if (chunkAttempts < maxLimit) {
              const waited = await sleepWithControl(jobId, RETRY_WAIT_MS);
              if (waited === 'cancelled') {
                console.log(`[transcribe] Job ${jobId} cancelled during retry sleep.`);
                await cancelJob(jobId, audioPath);
                return;
              }
            } else {
              console.error(`[transcribe] Chunk ${chunk.index} failed after all ${maxLimit} attempts.`);
              throw chunkErr;
            }
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
          // Reload settings
          const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
          const currentApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
          const currentGcpJson = settings?.gcpCredentialsJson || '';

          const result = await transcribeChunk({
            filePath: chunk.filePath,
            modelId: activeModel,
            chunkIndex: chunk.index,
            timeOffset: chunk.startTime,
            aiProvider: settings?.aiProvider || 'auto',
            geminiApiKey: currentApiKey,
            gcpProjectId: settings?.gcpProjectId,
            gcpLocation: settings?.gcpLocation,
            gcpCredentialsPath: settings?.gcpCredentialsPath,
            gcpCredentialsJson: currentGcpJson || null,
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
    try {
      if (filePath && filePath !== audioPath) {
        fs.unlinkSync(filePath);
      }
    } catch {}
    try { fs.rmdirSync(tempDir); } catch {}
  }
}
