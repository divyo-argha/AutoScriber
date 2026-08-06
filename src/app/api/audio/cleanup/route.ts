import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'data', 'audio');

export async function POST(request: NextRequest) {
  try {
    if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
      return NextResponse.json({ success: true, filesDeleted: 0, bytesFreed: 0 });
    }

    // Retrieve all active audio paths registered in the DB
    const jobs = await db.transcriptionJob.findMany({
      select: { audioPath: true },
    });

    const activePaths = new Set(
      jobs
        .map(j => j.audioPath)
        .filter((p): p is string => Boolean(p))
        .map(p => path.resolve(p))
    );

    const files = fs.readdirSync(AUDIO_STORAGE_DIR);
    let filesDeleted = 0;
    let bytesFreed = 0;

    for (const file of files) {
      const fullPath = path.resolve(path.join(AUDIO_STORAGE_DIR, file));
      if (!activePaths.has(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          bytesFreed += stats.size;
          fs.unlinkSync(fullPath);
          filesDeleted++;
          console.log(`[cleanup] Deleted orphan audio file: ${fullPath} (${stats.size} bytes)`);
        } catch (err) {
          console.error(`[cleanup] Failed to delete file ${fullPath}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      filesDeleted,
      bytesFreed,
      formattedFreed: (bytesFreed / (1024 * 1024)).toFixed(2) + ' MB',
    });
  } catch (err) {
    console.error('[cleanup] Storage cleanup error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Storage cleanup failed',
    }, { status: 500 });
  }
}
