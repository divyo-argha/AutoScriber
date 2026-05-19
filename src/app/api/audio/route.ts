import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await db.transcriptionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.audioPath) {
      return NextResponse.json({ error: 'No audio path stored' }, { status: 404 });
    }

    // Check if file exists
    if (!fs.existsSync(job.audioPath)) {
      console.warn(`[audio] Audio file not found at: ${job.audioPath}`);
      return NextResponse.json({ error: 'Audio file not found on disk' }, { status: 404 });
    }

    try {
      const audioBuffer = fs.readFileSync(job.audioPath);

      // Determine content type from file extension
      const ext = path.extname(job.audioPath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.webm': 'audio/webm',
        '.aac': 'audio/aac',
      };
      const contentType = mimeMap[ext] || 'audio/mpeg';

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(audioBuffer.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (readErr) {
      console.error(`[audio] Failed to read file: ${job.audioPath}`, readErr);
      return NextResponse.json({ error: 'Failed to read audio file' }, { status: 500 });
    }
  } catch (err) {
    console.error('[audio] Error serving audio:', err);
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 });
  }
}
