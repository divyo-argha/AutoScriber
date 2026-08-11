'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { XCircle, Ban, Trash2, Loader2, Layers, Play, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseChunkResults } from '@/lib/api';
import type { JobRecord } from '@/lib/api';
import { cleanAndMergeSegments } from '@/lib/transcriber/merger';
import { formatDate, formatDuration } from './completed-job-card';
import styles from './history-view.module.css';

function formatPreviewTime(startTime: unknown): string {
  if (typeof startTime !== 'number') return '0:00';
  return `${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}`;
}

interface FailedJobCardProps {
  job: JobRecord;
  index: number;
  expanded: boolean;
  deleting: boolean;
  recovering: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRecover: () => void;
  onExport: (format: 'txt' | 'md' | 'srt') => void;
}

export function FailedJobCard({
  job,
  index,
  expanded,
  deleting,
  recovering,
  onToggle,
  onDelete,
  onRecover,
  onExport,
}: FailedJobCardProps) {
  const isFailed = job.status === 'failed';

  // Determine if there's any partial chunk data to recover
  let segments: Array<{ startTime?: number; speaker?: string; text?: string }> = [];
  let chunkCount = 0;
  try {
    const rawChunks = parseChunkResults(job);
    if (rawChunks && rawChunks.length > 0) {
      chunkCount = rawChunks.length;
      const allSegments = (rawChunks as Array<{ segments: Array<{ startTime: number; endTime: number; speaker: string; text: string }> }>)
        .flatMap(c => c.segments || []);
      segments = cleanAndMergeSegments(allSegments);
    }
  } catch {}

  const canRecover = segments.length > 0;
  const progress = job.chunksTotal > 0
    ? Math.round((job.chunksDone / job.chunksTotal) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className={styles.failedCard}>
        <div
          className={styles.failedCardInner}
          onClick={onToggle}
          style={{ cursor: 'pointer' }}
        >
          {/* Icon + status badge */}
          <div className={`${styles.jobIconWrap} ${styles.jobIconWrapMuted}`}>
            {isFailed ? (
              <XCircle className={`${styles.jobIcon} ${styles.jobIconDestructive}`} />
            ) : (
              <Ban className={`${styles.jobIcon} ${styles.jobIconAmber}`} />
            )}
          </div>

          {/* Main info */}
          <div className={styles.jobBody}>
            <div className={styles.jobTitleRow}>
              <p className={styles.jobName}>{job.fileName}</p>
              <Badge
                variant="outline"
                className={isFailed ? styles.badgeFailed : styles.badgeCancelled}
              >
                {isFailed ? 'Failed' : 'Cancelled'}
              </Badge>
              {job.model && (
                <Badge variant="outline" className={styles.jobModelBadge}>
                  {job.model}
                </Badge>
              )}
            </div>

            <div className={styles.failedMeta}>
              {formatDuration(job.duration) !== '--:--' && (
                <span className={styles.metaItem}>{formatDuration(job.duration)}</span>
              )}
              {progress !== null && (
                <span className={styles.metaItem}>
                  <Layers className={styles.iconXs} />
                  {job.chunksDone}/{job.chunksTotal} chunks ({progress}%)
                </span>
              )}
              <span className={styles.otherDate}>{formatDate(job.createdAt)}</span>
            </div>

            {job.errorMessage && isFailed && (
              <p className={styles.failedError}>{job.errorMessage}</p>
            )}

            {canRecover && (
              <p className={styles.recoverHint}>
                {chunkCount} chunk{chunkCount !== 1 ? 's' : ''} of partial transcription data available ({segments.length} segments)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className={styles.failedActions}>
            {canRecover && (
              <Button
                variant="outline"
                size="sm"
                className={styles.recoverBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRecover();
                }}
                disabled={recovering || deleting}
              >
                {recovering ? (
                  <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} />
                ) : (
                  <Play className={styles.iconXs} />
                )}
                {recovering ? 'Loading...' : 'View Partial'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`${styles.iconBtnDanger} ${styles.shrink}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={deleting || recovering}
            >
              {deleting
                ? <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} />
                : <Trash2 className={styles.iconSm} />
              }
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.previewWrap}
            >
              <div className={styles.previewInner}>
                {job.errorMessage && (
                  <div
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '0.75rem',
                      color: 'var(--destructive)',
                    }}
                  >
                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Error details:</p>
                    <p style={{ fontFamily: 'var(--font-mono-stack)', whiteSpace: 'pre-wrap' }}>{job.errorMessage}</p>
                  </div>
                )}

                {segments.length > 0 ? (
                  <div className={styles.previewList}>
                    {segments.slice(0, 10).map((seg, idx) => (
                      <div key={idx} className={styles.previewRow}>
                        <span className={styles.previewTime}>{formatPreviewTime(seg.startTime)}</span>
                        <span className={styles.previewSpeaker}>{String(seg.speaker)}:</span>
                        <span className={styles.previewText}>{seg.text}</span>
                      </div>
                    ))}
                    {segments.length > 10 && (
                      <p className={styles.previewMore}>
                        ...and {segments.length - 10} more segments. Click "View Partial" to open full interactive viewer.
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                    No partial transcription segments available.
                  </p>
                )}

                {segments.length > 0 && (
                  <div className={styles.exportRow}>
                    <span className={styles.exportLabel}>
                      <Download className={styles.iconXs} />
                      Quick export:
                    </span>
                    {(['txt', 'md', 'srt'] as const).map(format => (
                      <Button
                        key={format}
                        variant="ghost"
                        size="sm"
                        className={styles.exportBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onExport(format);
                        }}
                      >
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

