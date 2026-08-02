import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ChunkInfo, SlicerOptions } from './types';

const execFileAsync = promisify(execFile);

function getFfmpegBinary(): string {
  if (process.platform === 'darwin' && fs.existsSync('/opt/homebrew/bin/ffmpeg')) {
    return '/opt/homebrew/bin/ffmpeg';
  }
  return 'ffmpeg';
}

function getFfprobeBinary(): string {
  if (process.platform === 'darwin' && fs.existsSync('/opt/homebrew/bin/ffprobe')) {
    return '/opt/homebrew/bin/ffprobe';
  }
  return 'ffprobe';
}

export async function getAudioDuration(filePath: string): Promise<number> {
  const ffprobePath = getFfprobeBinary();
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) || duration <= 0 ? 0 : duration;
  } catch (err) {
    console.error('[slicer] ffprobe failed to get audio duration:', err);
    return 0;
  }
}

/**
 * Split an audio file into 5-minute segments with 30s overlaps at both start and end up front.
 * Uses pure FFmpeg in parallel with fast input seeking. NO AI involved.
 */
export async function splitAudioIntoChunks(
  filePath: string,
  options?: SlicerOptions
): Promise<ChunkInfo[]> {
  const chunkDuration = options?.chunkDuration ?? 300; // 5 mins (300s)
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

  const chunkSpecs: {
    index: number;
    outputPath: string;
    chunkStart: number;
    chunkActualDuration: number;
    coreStart: number;
    coreEnd: number;
    hasStartOverlap: boolean;
    hasEndOverlap: boolean;
  }[] = [];

  let index = 0;
  for (let coreStart = 0; coreStart < duration; coreStart += chunkDuration) {
    const coreEnd = Math.min(coreStart + chunkDuration, duration);
    const hasStartOverlap = coreStart > 0;
    const chunkStart = Math.max(0, coreStart - (hasStartOverlap ? overlapDuration : 0));
    const hasEndOverlap = coreEnd < duration;
    const chunkEnd = Math.min(duration, coreEnd + (hasEndOverlap ? overlapDuration : 0));
    const chunkActualDuration = chunkEnd - chunkStart;

    const outputFileName = `chunk_${index.toString().padStart(4, '0')}.mp3`;
    const outputPath = path.join(outputDir, outputFileName);

    chunkSpecs.push({
      index,
      outputPath,
      chunkStart,
      chunkActualDuration,
      coreStart,
      coreEnd,
      hasStartOverlap,
      hasEndOverlap,
    });

    index++;
  }

  console.log(`[slicer] Splitting ${Math.round(duration)}s audio into ${chunkSpecs.length} chunks (pure FFmpeg, fast parallel extraction)...`);

  // Extract all chunks in parallel using pure FFmpeg (fast input seek -ss before -i)
  await Promise.all(
    chunkSpecs.map(spec =>
      extractAudioChunkFast(filePath, spec.outputPath, spec.chunkStart, spec.chunkActualDuration)
    )
  );

  console.log(`[slicer] Pure FFmpeg chunking complete for all ${chunkSpecs.length} chunks.`);

  return chunkSpecs.map(spec => ({
    index: spec.index,
    filePath: spec.outputPath,
    startTime: spec.chunkStart,
    duration: spec.chunkActualDuration,
    coreStartTime: spec.coreStart,
    coreEndTime: spec.coreEnd,
    hasStartOverlap: spec.hasStartOverlap,
    hasEndOverlap: spec.hasEndOverlap,
  }));
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
  const ffmpegPath = getFfmpegBinary();
  const args = [
    '-ss', startTime.toFixed(3),
    '-i', inputPath,
    '-t', duration.toFixed(3),
    '-c:a', 'libmp3lame',
    '-b:a', '96k',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, (err) => {
      if (err) {
        console.error(`[slicer] Error slicing chunk at ${startTime}s:`, err);
        reject(err);
      } else {
        resolve();
      }
    });
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

