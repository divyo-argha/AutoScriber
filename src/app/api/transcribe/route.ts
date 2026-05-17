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

export const maxDuration = 300; // 5 minutes max for the API route

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelId = (formData.get('model') as string) || 'gemini-2.5-flash';
    const geminiApiKey = (formData.get('geminiApiKey') as string) || '';
    const ollamaUrl = (formData.get('ollamaUrl') as string) || 'http://localhost:11434';
    const chunkDuration = parseInt(formData.get('chunkDuration') as string) || 300;
    const overlapDuration = parseInt(formData.get('overlapDuration') as string) || 10;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (not empty)
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
        // If chunking fails (e.g., ffmpeg can't parse the file),
        // fall back to using the whole file as a single chunk
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

      for (const chunk of chunks) {
        try {
          let result;

          if (modelInfo.provider === 'gemini') {
            result = await transcribeChunkWithGemini(
              chunk.filePath,
              geminiApiKey,
              modelId,
              chunk.index,
              chunk.startTime
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
          const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.error(`[transcribe] Error processing chunk ${chunk.index}:`, errMsg);
          chunkErrors.push(`Chunk ${chunk.index}: ${errMsg}`);
          chunksDone++;
          // Continue with other chunks even if one fails
        }
      }

      console.log(`[transcribe] Total segments collected: ${allSegments.length}`);

      // If no segments at all were produced, return a meaningful error
      if (allSegments.length === 0) {
        const errorDetail = chunkErrors.length > 0
          ? `Transcription produced no results. Errors: ${chunkErrors.join('; ')}`
          : 'Transcription produced no results. The audio may be empty, too quiet, or in an unsupported format. Please check your audio file and try again.';

        await db.transcriptionJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: errorDetail,
          },
        });

        // Cleanup temp files
        cleanupChunks(chunks);
        try { fs.unlinkSync(filePath); } catch {}
        try { fs.rmdirSync(tempDir); } catch {}

        return NextResponse.json({
          jobId: job.id,
          status: 'failed',
          error: errorDetail,
        }, { status: 422 });
      }

      // Merge overlapping segments and deduplicate speakers
      const mergedSegments = mergeSegments(allSegments);

      // Build full text
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

      // Cleanup temp files
      cleanupChunks(chunks);
      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}

      return NextResponse.json({
        jobId: job.id,
        status: 'completed',
        result,
      });

    } catch (processErr) {
      const errorMessage = processErr instanceof Error ? processErr.message : 'Unknown error';
      console.error('[transcribe] Processing error:', errorMessage);

      await db.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      // Cleanup
      try { fs.unlinkSync(filePath); } catch {}
      try { fs.rmdirSync(tempDir); } catch {}

      return NextResponse.json({
        jobId: job.id,
        status: 'failed',
        error: errorMessage,
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

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  const merged: TranscriptionSegment[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];

    // If same speaker and segments overlap or are close (within 2 seconds)
    if (
      current.speaker === seg.speaker &&
      seg.startTime - current.endTime < 2
    ) {
      // Merge
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
