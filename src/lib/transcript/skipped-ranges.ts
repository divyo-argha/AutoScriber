/**
 * Computes the [start, end] time ranges covered by skipped (failed) chunks so
 * users know exactly which parts of the recording may be missing.
 */
export function buildSkippedRanges(
  skippedChunks: number[],
  chunkDuration: number,
  audioDuration: number
): [number, number][] {
  const dur = Math.max(chunkDuration || 300, 1);
  return skippedChunks
    .sort((a, b) => a - b)
    .map(i => {
      const start = i * dur;
      const end = Math.min((i + 1) * dur, audioDuration > 0 ? audioDuration : (i + 1) * dur);
      return [start, end] as [number, number];
    });
}
