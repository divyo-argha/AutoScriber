import { ChunkResult } from '@/lib/transcriber/types';
import { cleanAndMergeSegments } from '@/lib/transcriber/merger';

export function downloadPartialTranscript(
  liveChunkResults: ChunkResult[],
  failureReason: 'cancelled' | 'failed' | 'error'
) {
  if (!liveChunkResults || liveChunkResults.length === 0) return;

  const allSegments = liveChunkResults.flatMap(c => c.segments);
  const merged = cleanAndMergeSegments(allSegments);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  let text = merged.map(s => `[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`).join('\n');

  if (failureReason === 'cancelled') {
    text += '\n\n[⚠️ TRANSCRIPTION CANCELLED BY USER AT THIS POINT]';
  } else if (failureReason === 'failed' || failureReason === 'error') {
    text += '\n\n[⚠️ TRANSCRIPTION FAILED AT THIS POINT - CONNECTION OR ERROR OCCURRED]';
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Partial_Transcript_${failureReason}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
