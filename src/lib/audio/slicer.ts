import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ChunkInfo, SlicerOptions } from './types';

// On macOS, Next.js background workers might run without /opt/homebrew/bin in PATH.
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

/**
 * Split an audio file into 10-minute segments with 30s overlaps at both start and end.
 *
 * Example for 25-minute audio file (coreDuration=600, overlap=30):
 * - Chunk 0: [0s, 630s] (Core: 0s - 600s)
 * - Chunk 1: [570s, 1230s] (Core: 600s - 1200s, 30s overlap at start & end)
 * - Chunk 2: [1170s, 1500s] (Core: 1200s - 1500s, 30s overlap at start)
 */
export async function splitAudioIntoChunks(
  filePath: string,
  options?: SlicerOptions
): Promise<ChunkInfo[]> {
  const chunkDuration = options?.chunkDuration ?? 600; // 10 mins (600s)
  const overlapDuration = options?.overlapDuration ?? 30; // 30s overlap
  let outputDir = options?.outputDir;

  let duration: number;
  try {
    duration = await getAudioDuration(filePath);
  } catch (err) {
    console.error('[slicer] Failed to get audio duration, using whole file:', err);
    return [{
      index: 0,
      filePath,
      startTime: 0,
      duration: 0,
      coreStartTime: 0,
      coreEndTime: 0,
      hasStartOverlap: false,
      hasEndOverlap: false,
    }];
  }

  if (!duration || !isFinite(duration) || duration <= 0) {
    console.warn('[slicer] Audio duration is 0 or invalid, using whole file as single chunk');
    return [{
      index: 0,
      filePath,
      startTime: 0,
      duration: 0,
      coreStartTime: 0,
      coreEndTime: 0,
      hasStartOverlap: false,
      hasEndOverlap: false,
    }];
  }

  if (!outputDir) {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-chunks-'));
  }

  // If audio is shorter than or equal to single chunk duration, no splitting needed
  if (duration <= chunkDuration) {
    return [{
      index: 0,
      filePath,
      startTime: 0,
      duration,
      coreStartTime: 0,
      coreEndTime: duration,
      hasStartOverlap: false,
      hasEndOverlap: false,
    }];
  }

  const chunks: ChunkInfo[] = [];
  let index = 0;

  for (let coreStart = 0; coreStart < duration; coreStart += chunkDuration) {
    const coreEnd = Math.min(coreStart + chunkDuration, duration);
    
    // Add 30s start overlap if not the first chunk
    const hasStartOverlap = coreStart > 0;
    const chunkStart = Math.max(0, coreStart - (hasStartOverlap ? overlapDuration : 0));

    // Add 30s end overlap if not the last chunk
    const hasEndOverlap = coreEnd < duration;
    const chunkEnd = Math.min(duration, coreEnd + (hasEndOverlap ? overlapDuration : 0));
    
    const chunkActualDuration = chunkEnd - chunkStart;
    const ext = path.extname(filePath) || '.mp3';
    const outputFileName = `chunk_${index.toString().padStart(4, '0')}${ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    await extractAudioChunkFast(filePath, outputPath, chunkStart, chunkActualDuration);

    chunks.push({
      index,
      filePath: outputPath,
      startTime: chunkStart,
      duration: chunkActualDuration,
      coreStartTime: coreStart,
      coreEndTime: coreEnd,
      hasStartOverlap,
      hasEndOverlap,
    });

    index++;
  }

  console.log(`[slicer] Split audio (${Math.round(duration)}s) into ${chunks.length} chunks of 10 mins with 30s overlap.`);
  return chunks;
}

/**
 * Fast audio chunk extraction with input seeking (-ss before -i) for maximum speed.
 */
function extractAudioChunkFast(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Attempt stream copy first for ultra-fast slicing
    const processStreamCopy = () => {
      ffmpeg()
        .input(inputPath)
        .inputOptions([`-ss ${startTime}`])
        .outputOptions([`-t ${duration}`, '-c copy', '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', () => {
          // If stream copy fails (e.g. non-matching codecs or keyframe issue), fallback to fast encoding
          processFastEncode();
        })
        .run();
    };

    const processFastEncode = () => {
      ffmpeg()
        .input(inputPath)
        .inputOptions([`-ss ${startTime}`, '-threads 0'])
        .outputOptions([
          `-t ${duration}`,
          '-c:a libmp3lame',
          '-q:a 5', // Fast low-complexity variable bitrate MP3 encoding
          '-y',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    };

    processStreamCopy();
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
      // Ignore
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
