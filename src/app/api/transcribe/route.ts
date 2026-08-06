import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAudioDuration } from '@/lib/audio/slicer';
import { getGcpCredentialsInfo, getGcpCredentialsInfoFromJson } from '@/lib/transcriber/gcp-credentials';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';
import { processTranscriptionJob } from '@/lib/jobs';
import { ensureAudioStorageDir, saveUploadedFile, savePersistentAudio } from '@/lib/server/audio-storage';
import fs from 'fs';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelId = (formData.get('model') as string) || 'gemini-2.0-flash';

    const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    const geminiApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    const storedGcpJson = settings?.gcpCredentialsJson || '';
    const gcpCreds = storedGcpJson
      ? getGcpCredentialsInfoFromJson(storedGcpJson, settings?.gcpLocation)
      : getGcpCredentialsInfo(settings?.gcpCredentialsPath, settings?.gcpLocation);
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
      return NextResponse.json({ error: 'Gemini API key or GCP Vertex credentials are required for transcription. Add them in Settings.' }, { status: 400 });
    }

    // Save the upload to a temp dir, and mirror it into persistent storage.
    const { filePath, tempDir } = await saveUploadedFile(file);
    let duration: number | null = null;
    try {
      const dur = await getAudioDuration(filePath);
      duration = typeof dur === 'number' && isFinite(dur) && dur > 0 ? dur : null;
      console.log(`[transcribe] Audio duration from ffprobe: ${duration}`);
    } catch (err) {
      console.error('[transcribe] Failed to get audio duration:', err);
    }

    const audioPath = await savePersistentAudio(filePath, file.name);

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
        audioPath,
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
      audioPath,
      aiProvider: settings?.aiProvider || 'auto',
      gcpProjectId: settings?.gcpProjectId,
      gcpLocation: settings?.gcpLocation,
      gcpCredentialsPath: settings?.gcpCredentialsPath,
      gcpCredentialsJson: storedGcpJson || null,
    });

    return NextResponse.json({ jobId: job.id, status: 'started' });
  } catch (err) {
    console.error('[transcribe] Top-level error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
