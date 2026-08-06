import type { TranscriptionSegment } from '@/lib/transcriber/types';

export const DEFAULT_SPEAKER_PALETTE = [
  'sp0', 'sp1', 'sp2', 'sp3', 'sp4', 'sp5', 'sp6', 'sp7',
] as const;

/**
 * Assigns a stable color key to each distinct speaker in order of appearance.
 * The returned keys map to classes in `speaker-colors.module.css`.
 */
export function buildSpeakerColors(
  segments: TranscriptionSegment[],
  palette: readonly string[] = DEFAULT_SPEAKER_PALETTE
): Record<string, string> {
  const map: Record<string, string> = {};
  let colorIdx = 0;
  for (const seg of segments) {
    if (!map[seg.speaker]) {
      map[seg.speaker] = palette[colorIdx % palette.length];
      colorIdx++;
    }
  }
  return map;
}

/** Returns the unique speaker names in order of first appearance. */
export function getUniqueSpeakers(segments: TranscriptionSegment[]): string[] {
  const speakers = new Set(segments.map(s => s.speaker));
  return Array.from(speakers);
}
