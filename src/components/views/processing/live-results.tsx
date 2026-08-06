import { CheckCircle2 } from 'lucide-react';
import type { ChunkResult } from '@/lib/transcriber/types';
import styles from './processing-view.module.css';

interface Props {
  liveChunkResults: ChunkResult[];
  chunkDuration: number;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
}

export function LiveResults({ liveChunkResults, chunkDuration }: Props) {
  if (!liveChunkResults || liveChunkResults.length === 0) return null;

  return (
    <div className={styles.liveSection}>
      <div className={styles.liveHeader}>
        <h3 className={styles.liveTitle}>
          <CheckCircle2 className={styles.liveTitleIcon} />
          Live Segment Transcriptions ({liveChunkResults.length} Ready)
        </h3>
      </div>
      <div className={styles.liveList}>
        {liveChunkResults.map((chunkRes, idx) => (
          <div key={idx} className={styles.liveItem}>
            <div className={styles.liveMeta}>
              <span className={styles.liveSegName}>
                Segment {chunkRes.chunkIndex + 1}
              </span>
              <span>{chunkRes.segments.length} dialogue turns</span>
            </div>
            <div className={styles.liveSegBlock}>
              {chunkRes.segments.slice(0, 3).map((seg, sIdx) => (
                <p key={sIdx} className={styles.liveSegLine}>
                  <span className={styles.liveSegSpeaker}>
                    [{formatTime(seg.startTime)}] {seg.speaker}:
                  </span>
                  {seg.text}
                </p>
              ))}
              {chunkRes.segments.length > 3 && (
                <p className={styles.liveMore}>
                  + {chunkRes.segments.length - 3} more segments in this {chunkDuration}s chunk...
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
