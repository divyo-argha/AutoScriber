import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitAudioIntoChunks, getAudioDuration, cleanupChunks, formatTime } from '@/lib/transcriber/chunker';
import { transcribeChunkWithGemini } from '@/lib/transcriber/gemini';
import { transcribeChunkWithOllama } from '@/lib/transcriber/ollama';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';
import type { TranscriptionSegment, TranscriptionResult } from '@/lib/transcriber/types';
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

/**
 * Detect if an error is a Gemini "location not supported" error
 * and return a user-friendly error with actionable suggestions.
 */
function classifyGeminiError(err: unknown): { isLocationError: boolean; message: string; suggestion: string } {
  const errMsg = err instanceof Error ? err.message : String(err);

  const isLocationError =
    errMsg.includes('User location is not supported') ||
    errMsg.includes('location is not supported for the API use') ||
    errMsg.includes('not available in your country') ||
    errMsg.includes('REGION') && errMsg.includes('not supported');

  if (isLocationError) {
    return {
      isLocationError: true,
      message: 'Gemini API is not available in your region.',
      suggestion: 'You can fix this by: (1) Setting up a proxy URL in Settings → Cloud → API Base URL, or (2) Switching to a local Ollama model. Go to Settings → Local to set up Ollama with a Gemma model.',
    };
  }

  return {
    isLocationError: false,
    message: errMsg,
    suggestion: '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelId = (formData.get('model') as string) || 'gemini-2.5-flash';
    const geminiApiKey = (formData.get('geminiApiKey') as string) || '';
    const geminiApiBaseUrl = (formData.get('geminiApiBaseUrl') as string) || '';
    const ollamaUrl = (formData.get('ollamaUrl') as string) || 'http://localhost:11434';
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

    // Save uploaded file to temp location
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-upload-'));
    const filePath = path.join(tempDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Validate the saved file isn't empty
    const savedStats = fs.statSync(filePath);
    if (savedStats.size === 0) {
      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}
      return NextResponse.json({
        error: 'The uploaded file is empty after saving. The recording may have failed — please try recording again.',
      }, { status: 400 });
    }

    console.log(`[transcribe] File saved: ${file.name}, size: ${savedStats.size} bytes`);

    // Also save to persistent storage for history playback
    ensureAudioStorageDir();
    const persistentAudioPath = path.join(AUDIO_STORAGE_DIR, `${Date.now()}_${file.name}`);
    try {
      fs.copyFileSync(filePath, persistentAudioPath);
      console.log(`[transcribe] Audio saved to persistent storage: ${persistentAudioPath}`);
    } catch (err) {
      console.error('[transcribe] Failed to save audio to persistent storage:', err);
    }

    // Get audio duration
    let duration: number | null = null;
    try {
      const dur = await getAudioDuration(filePath);
      duration = (typeof dur === 'number' && isFinite(dur) && dur > 0) ? dur : null;
      console.log(`[transcribe] Audio duration from ffprobe: ${duration}`);
    } catch (err) {
      console.error('[transcribe] Failed to get audio duration:', err);
    }

    // Create job in database
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

    try {
      // Split into chunks
      const effectiveChunkDuration = modelInfo.provider === 'ollama'
        ? Math.min(chunkDuration, modelInfo.maxAudioLength)
        : chunkDuration;

      let chunks;
      try {
        chunks = await splitAudioIntoChunks(
          filePath,
          effectiveChunkDuration,
          overlapDuration
        );
      } catch (chunkErr) {
        console.error('[transcribe] Chunking failed, using whole file as fallback:', chunkErr);
        chunks = [{
          index: 0,
          filePath,
          startTime: 0,
          duration: duration ?? 0,
        }];
      }

      console.log(`[transcribe] Split into ${chunks.length} chunk(s)`);

      await db.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'processing',
          chunksTotal: chunks.length,
        },
      });

      // Process each chunk
      const allSegments: TranscriptionSegment[] = [];
      const chunkErrors: string[] = [];
      let chunksDone = 0;
      let hasLocationError = false;

      for (const chunk of chunks) {
        try {
          let result;

          if (modelInfo.provider === 'gemini') {
            result = await transcribeChunkWithGemini(
              chunk.filePath,
              geminiApiKey,
              modelId,
              chunk.index,
              chunk.startTime,
              geminiApiBaseUrl || undefined
            );
          } else {
            result = await transcribeChunkWithOllama(
              chunk.filePath,
              modelId,
              ollamaUrl,
              chunk.index,
              chunk.startTime
            );
          }

          const segCount = result.segments.length;
          console.log(`[transcribe] Chunk ${chunk.index}: ${segCount} segments, rawText length: ${result.rawText?.length ?? 0}`);

          allSegments.push(...result.segments);
          chunksDone++;

          const progress = Math.round((chunksDone / chunks.length) * 100);
          await db.transcriptionJob.update({
            where: { id: job.id },
            data: {
              chunksDone,
              progress,
            },
          });
        } catch (chunkErr) {
          const classified = classifyGeminiError(chunkErr);
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.error(`[transcribe] Error processing chunk ${chunk.index}:`, errMsg);

          if (classified.isLocationError) {
            hasLocationError = true;
            chunkErrors.push(`Chunk ${chunk.index}: ${classified.message} ${classified.suggestion}`);
          } else {
            chunkErrors.push(`Chunk ${chunk.index}: ${errMsg}`);
          }
          chunksDone++;
        }
      }

      console.log(`[transcribe] Total segments collected: ${allSegments.length}`);

      if (allSegments.length === 0) {
        // Build a helpful error message
        let errorDetail: string;
        let errorType: string = 'generic';

        if (hasLocationError) {
          errorDetail = `Gemini API is not available in your region. ${chunkErrors.map(e => e.replace(/^Chunk \d+:\s*/, '')).join(' ')}`;
          errorType = 'location_blocked';
        } else if (chunkErrors.length > 0) {
          errorDetail = `Transcription produced no results. Errors: ${chunkErrors.join('; ')}`;
        } else {
          errorDetail = 'Transcription produced no results. The audio may be empty, too quiet, or in an unsupported format.';
        }

        await db.transcriptionJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: errorDetail,
          },
        });

        cleanupChunks(chunks);
        try { fs.unlinkSync(filePath); } catch {}
        try { fs.rmdirSync(tempDir); } catch {}

        return NextResponse.json({
          jobId: job.id,
          status: 'failed',
          error: errorDetail,
          errorType,
        }, { status: 422 });
      }

      const mergedSegments = mergeSegments(allSegments);

      const fullText = mergedSegments
        .map(seg => `[${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}] ${seg.speaker}: ${seg.text}`)
        .join('\n');

      const result: TranscriptionResult = {
        segments: mergedSegments,
        fullText,
        duration: duration ?? 0,
        language: 'bn',
        model: modelId,
      };

      await db.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          progress: 100,
          chunksDone: chunks.length,
          result: JSON.stringify(result),
        },
      });

      cleanupChunks(chunks);
      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}

      return NextResponse.json({
        jobId: job.id,
        status: 'completed',
        result,
      });

    } catch (processErr) {
      const classified = classifyGeminiError(processErr);
      let errorMessage: string;
      let errorType: string | undefined;

      if (classified.isLocationError) {
        errorMessage = classified.message + ' ' + classified.suggestion;
        errorType = 'location_blocked';
      } else {
        errorMessage = processErr instanceof Error ? processErr.message : 'Unknown error';
      }

      console.error('[transcribe] Processing error:', errorMessage);

      await db.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}

      return NextResponse.json({
        jobId: job.id,
        status: 'failed',
        error: errorMessage,
        ...(errorType ? { errorType } : {}),
      }, { status: 500 });
    }

  } catch (err) {
    console.error('[transcribe] Top-level error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

function mergeSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  const merged: TranscriptionSegment[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];

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
