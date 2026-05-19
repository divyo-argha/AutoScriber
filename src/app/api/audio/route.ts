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
      const stats = fs.statSync(job.audioPath);
      const fileSize = stats.size;
      const range = request.headers.get('range');

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

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
            }
          });
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(job.audioPath, { start, end });

        return new NextResponse(fileStream as any, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunksize),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } else {
        const fileStream = fs.createReadStream(job.audioPath);
        return new NextResponse(fileStream as any, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (readErr) {
      console.error(`[audio] Failed to stream file: ${job.audioPath}`, readErr);
      return NextResponse.json({ error: 'Failed to read audio file' }, { status: 500 });
    }
  } catch (err) {
    console.error('[audio] Error serving audio:', err);
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 });
  }
}
