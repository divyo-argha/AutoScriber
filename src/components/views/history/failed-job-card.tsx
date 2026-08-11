'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { XCircle, Ban, Trash2, Loader2, Layers, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { JobRecord } from '@/lib/api';
import { formatDate, formatDuration } from './completed-job-card';
import styles from './history-view.module.css';

interface FailedJobCardProps {
  job: JobRecord;
  index: number;
  deleting: boolean;
  recovering: boolean;
  onDelete: () => void;
  onRecover: () => void;
}

export function FailedJobCard({ job, index, deleting, recovering, onDelete, onRecover }: FailedJobCardProps) {
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  // Determine if there's any partial chunk data to recover
  let chunkCount = 0;
  try {
    if (job.chunkResults) {
      const parsed = JSON.parse(job.chunkResults);
      chunkCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {}

  const canRecover = chunkCount > 0;
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
        <div className={styles.failedCardInner}>
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
                {chunkCount} chunk{chunkCount !== 1 ? 's' : ''} of partial transcription data available
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
                onClick={onRecover}
                disabled={recovering || deleting}
              >
                {recovering ? (
                  <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} />
                ) : (
                  <RefreshCw className={styles.iconSm} />
                )}
                {recovering ? 'Recovering...' : 'Recover Partial'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`${styles.iconBtnDanger} ${styles.shrink}`}
              onClick={onDelete}
              disabled={deleting || recovering}
            >
              {deleting
                ? <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} />
                : <Trash2 className={styles.iconSm} />
              }
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
