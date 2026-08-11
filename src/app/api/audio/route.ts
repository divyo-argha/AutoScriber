import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
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

    const resolvedPath = path.isAbsolute(job.audioPath)
      ? job.audioPath
      : path.join(process.cwd(), job.audioPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[audio] Audio file not found at: ${resolvedPath} (stored: ${job.audioPath})`);
      return NextResponse.json({ error: 'Audio file not found on disk' }, { status: 404 });
    }

    try {
      const stats = fs.statSync(resolvedPath);
      const fileSize = stats.size;
      const range = request.headers.get('range');

      // Determine content type from file extension
      const ext = path.extname(resolvedPath).toLowerCase();
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

        if (isNaN(start) || start < 0 || end >= fileSize) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
            }
          });
        }

        const effectiveEnd = isNaN(end) || end < start ? start : end;
        const chunksize = (effectiveEnd - start) + 1;
        const nodeStream = fs.createReadStream(resolvedPath, { start, end: effectiveEnd });
        const webStream = Readable.toWeb(nodeStream);

        return new NextResponse(webStream as any, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${effectiveEnd}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunksize),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } else {
        const nodeStream = fs.createReadStream(resolvedPath);
        const webStream = Readable.toWeb(nodeStream);

        return new NextResponse(webStream as any, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (readErr) {
      console.error(`[audio] Failed to stream file: ${resolvedPath}`, readErr);
      return NextResponse.json({ error: 'Failed to read audio file' }, { status: 500 });
    }
  } catch (err) {
    console.error('[audio] Error serving audio:', err);
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 });
  }
}
