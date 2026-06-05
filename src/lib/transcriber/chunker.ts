import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { formatTime } from '@/lib/format-utils';

// On macOS, Next.js background workers might run without /opt/homebrew/bin in PATH.
// Explicitly configure fluent-ffmpeg paths if standard Homebrew binaries are found.
if (process.platform === 'darwin') {
  const brewFfmpeg = '/opt/homebrew/bin/ffmpeg';
  const brewFfprobe = '/opt/homebrew/bin/ffprobe';
  if (fs.existsSync(brewFfmpeg)) {
    ffmpeg.setFfmpegPath(brewFfmpeg);
  }
  if (fs.existsSync(brewFfprobe)) {
    ffmpeg.setFfprobePath(brewFfprobe);
  }
}

export interface ChunkInfo {
  index: number;
  filePath: string;
  startTime: number;
  duration: number;
}

export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata.format?.duration || 0;
      resolve(duration);
    });
  });
}

export async function splitAudioIntoChunks(
  filePath: string,
  chunkDuration: number = 300,
  overlapDuration: number = 10,
  outputDir?: string
): Promise<ChunkInfo[]> {
  let duration: number;
  try {
    duration = await getAudioDuration(filePath);
  } catch (err) {
    console.error('[chunker] Failed to get audio duration, using whole file as single chunk:', err);
    // If we can't determine duration, use the whole file as a single chunk
    // The duration of 0 signals "unknown" — the transcriber will still try to process it
    return [{
      index: 0,
      filePath,
      startTime: 0,
      duration: 0,
    }];
  }

  // If duration is 0 or invalid, still try the whole file
  if (!duration || !isFinite(duration) || duration <= 0) {
    console.warn('[chunker] Audio duration is 0 or invalid, using whole file as single chunk');
    return [{
      index: 0,
      filePath,
      startTime: 0,
      duration: 0,
    }];
  }

  const chunks: ChunkInfo[] = [];

  if (!outputDir) {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-chunks-'));
  }

  if (duration <= chunkDuration) {
    chunks.push({
      index: 0,
      filePath,
      startTime: 0,
      duration,
    });
    return chunks;
  }

  let startTime = 0;
  let index = 0;

  while (startTime < duration) {
    const chunkEnd = Math.min(startTime + chunkDuration, duration);
    const actualDuration = chunkEnd - startTime;
    const outputFileName = `chunk_${index.toString().padStart(4, '0')}.mp3`;
    const outputPath = path.join(outputDir, outputFileName);

    await extractAudioChunk(filePath, outputPath, startTime, actualDuration);

    chunks.push({
      index,
      filePath: outputPath,
      startTime,
      duration: actualDuration,
    });

    startTime += chunkDuration - overlapDuration;
    index++;

    if (index > 100) break;
  }

  return chunks;
}

function extractAudioChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function cleanupChunks(chunks: ChunkInfo[]): void {
  for (const chunk of chunks) {
    try {
      if (chunk.filePath && fs.existsSync(chunk.filePath)) {
        if (chunk.index > 0 || chunks.length > 1) {
          fs.unlinkSync(chunk.filePath);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  if (chunks.length > 0) {
    const dir = path.dirname(chunks[0].filePath);
    try {
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch {
      // Ignore
    }
  }
}

export { formatTime };
