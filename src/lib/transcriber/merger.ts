import type { TranscriptionSegment, ChunkResult } from './types';
import type { ChunkInfo } from '../audio/types';

/**
 * Merge transcribed chunks into a single, deduplicated segment list.
 *
 * Chunks overlap by `overlapDuration` seconds at their boundaries, so the same
 * speech is transcribed twice (once per neighboring chunk), usually with
 * slightly different timestamps and wording. Chunk timestamps are unreliable
 * (Gemini timestamps drift by several seconds, and responses can be truncated),
 * so instead of trusting timestamps to split "core" regions — which silently
 * drops real content — we keep every segment and deduplicate globally using
 * fuzzy text similarity combined with time proximity.
 */
export function mergeChunkResults(
  chunkResults: { chunk: ChunkInfo; result: ChunkResult }[]
): TranscriptionSegment[] {
  const allSegments: TranscriptionSegment[] = [];
  for (const { result } of chunkResults) {
    allSegments.push(...result.segments);
  }
  return cleanAndMergeSegments(allSegments);
}

// Maximum time (seconds) between two transcriptions of the same speech.
// Equals the chunk overlap window plus room for timestamp drift.
const DEDUP_WINDOW = 45;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Jaccard similarity of the token sets (0..1). */
function textSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let shared = 0;
  for (const t of setA) {
    if (setB.has(t)) shared++;
  }
  const union = setA.size + setB.size - shared;
  return union > 0 ? shared / union : 0;
}

/**
 * True when the shorter text appears as a contiguous prefix/suffix of the
 * longer one — the signature of a sentence that crosses a chunk boundary and
 * was transcribed twice, with one version truncated at the cut point.
 */
function isBoundaryContinuation(a: string, b: string): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const shorter = ta.length <= tb.length ? ta : tb;
  const longer = ta.length <= tb.length ? tb : ta;
  if (shorter.length * 1.4 > longer.length) return false;

  const shorterStr = shorter.join(' ');
  const longerStr = longer.join(' ');
  const pos = longerStr.indexOf(shorterStr);
  if (pos === -1) return false;
  const before = pos === 0 ? '' : longerStr[pos - 1];
  const afterEnd = pos + shorterStr.length;
  const after = afterEnd >= longerStr.length ? '' : longerStr[afterEnd];
  return (pos === 0 || before === ' ') && (afterEnd === longerStr.length || after === ' ');
}

/** True when `seg` is a second transcription of the same speech as `existing`. */
function isDuplicate(existing: TranscriptionSegment, seg: TranscriptionSegment): boolean {
  const overlap = Math.min(seg.endTime, existing.endTime) - Math.max(seg.startTime, existing.startTime);
  const startGap = Math.abs(seg.startTime - existing.startTime);
  const nearInTime = overlap > 0.2 || startGap < 5;
  if (!nearInTime) return false;

  const sim = textSimilarity(existing.text, seg.text);
  const minTokenCount = Math.min(tokenize(existing.text).length, tokenize(seg.text).length);

  if (existing.speaker === seg.speaker) {
    if (sim >= 0.5) return true;
    if (isBoundaryContinuation(existing.text, seg.text) && sim >= 0.25) return true;
    // Same speech split into different segment sizes across chunks
    return overlap > 2 && sim >= 0.3;
  }

  // Speaker labels are assigned independently per chunk and can disagree for
  // the same voice; only treat as a duplicate on a very strong text match.
  return sim >= 0.8 && minTokenCount >= 6;
}

/**
 * Sorts segments, removes duplicate transcriptions of the same speech at chunk
 * boundaries, and merges consecutive segments from the same speaker.
 */
export function cleanAndMergeSegments(
  segments: TranscriptionSegment[]
): TranscriptionSegment[] {
  if (segments.length === 0) return [];

  // Sort chronologically by start time
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  // Deduplicate: for each segment, scan the already-kept segments within the
  // overlap window. When two segments describe the same speech, keep the more
  // complete (longer) text but preserve the earliest timestamp.
  const deduped: TranscriptionSegment[] = [];
  for (const seg of sorted) {
    let duplicateIdx = -1;
    for (let i = deduped.length - 1; i >= 0; i--) {
      const existing = deduped[i];
      if (seg.startTime - existing.startTime > DEDUP_WINDOW) break;
      if (isDuplicate(existing, seg)) {
        duplicateIdx = i;
        break;
      }
    }

    if (duplicateIdx === -1) {
      deduped.push(seg);
      continue;
    }

    const existing = deduped[duplicateIdx];
    if (tokenize(seg.text).length > tokenize(existing.text).length) {
      // The later chunk has the full sentence (the earlier one was truncated
      // at the boundary) — take its text but keep the earlier timestamps.
      deduped[duplicateIdx] = {
        ...seg,
        startTime: Math.min(existing.startTime, seg.startTime),
        endTime: Math.max(existing.endTime, seg.endTime),
        speaker: existing.speaker,
      };
    } else if (seg.startTime < existing.startTime) {
      deduped[duplicateIdx] = { ...existing, startTime: seg.startTime };
    }
  }

  // Merge consecutive same-speaker segments with short gaps (< 3 seconds),
  // which also heals seams at chunk boundaries.
  const merged: TranscriptionSegment[] = [];
  let current = { ...deduped[0] };

  for (let i = 1; i < deduped.length; i++) {
    const seg = deduped[i];
    if (
      current.speaker === seg.speaker &&
      seg.startTime - current.endTime < 3.0
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
