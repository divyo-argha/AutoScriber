import type { TranscriptionSegment, ChunkResult } from './types';
import type { ChunkInfo } from '../audio/types';

/**
 * Filter, deduplicate overlaps, and merge transcription segments across 10-min audio chunks.
 *
 * Each chunk $i$ was sliced with a core window $[i \times 600, (i+1) \times 600]$
 * plus a 30s overlap at the start ($i \times 600 - 30$) and end ($(i+1) \times 600 + 30$).
 */
export function mergeChunkResults(
  chunkResults: { chunk: ChunkInfo; result: ChunkResult }[]
): TranscriptionSegment[] {
  if (chunkResults.length === 0) return [];

  const allFilteredSegments: TranscriptionSegment[] = [];

  for (const { chunk, result } of chunkResults) {
    const { coreStartTime, coreEndTime, index } = chunk;

    // Filter segments to retain only those originating within this chunk's assigned core window
    for (const seg of result.segments) {
      // For Chunk 0: include segments from start up to coreEndTime
      // For Chunk i > 0: include segments starting >= coreStartTime and < coreEndTime
      const belongsToChunk =
        index === 0
          ? seg.startTime < coreEndTime
          : seg.startTime >= coreStartTime && seg.startTime < coreEndTime;

      if (belongsToChunk) {
        allFilteredSegments.push(seg);
      }
    }
  }

  return cleanAndMergeSegments(allFilteredSegments);
}

/**
 * Sorts segments, removes duplicate phrases at boundary points,
 * and merges consecutive segments from the same speaker.
 */
export function cleanAndMergeSegments(
  segments: TranscriptionSegment[]
): TranscriptionSegment[] {
  if (segments.length === 0) return [];

  // Sort chronologically by start time
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  // Deduplicate segments that overlap closely in time and text
  const deduped: TranscriptionSegment[] = [];
  for (const seg of sorted) {
    const isDuplicate = deduped.some(existing => {
      const timeDiff = Math.abs(existing.startTime - seg.startTime);
      const normExisting = existing.text.trim().toLowerCase().replace(/[^\w\s\u0980-\u09FF]/g, '');
      const normSeg = seg.text.trim().toLowerCase().replace(/[^\w\s\u0980-\u09FF]/g, '');

      // Time gap within 3 seconds and identical/contained text
      return (
        timeDiff < 3.0 &&
        (normExisting === normSeg ||
          normExisting.includes(normSeg) ||
          normSeg.includes(normExisting))
      );
    });

    if (!isDuplicate) {
      deduped.push(seg);
    }
  }

  // Merge consecutive same-speaker segments with short gaps (< 2 seconds)
  const merged: TranscriptionSegment[] = [];
  let current = { ...deduped[0] };

  for (let i = 1; i < deduped.length; i++) {
    const seg = deduped[i];
    if (
      current.speaker === seg.speaker &&
      seg.startTime - current.endTime < 2.0
    ) {
      current.endTime = Math.max(current.endTime, seg.endTime);
      current.text = `${current.text.trim()} ${seg.text.trim()}`;
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);

  return merged;
}
