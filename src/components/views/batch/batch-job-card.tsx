import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Loader2, Download, Clock, User, AlertTriangle, FileAudio,
} from 'lucide-react';
import type { BatchJob } from '@/lib/store';
import { formatTime } from '@/lib/format-utils';
import type { ClientExportFormat } from '@/lib/transcript/download';
import styles from './batch-view.module.css';

interface BatchJobCardProps {
  job: BatchJob;
  index: number;
  chunkDuration: number;
  onDownload: (format: ClientExportFormat) => void;
}

export function BatchJobCard({ job, index, chunkDuration, onDownload }: BatchJobCardProps) {
  const speakerCount = job.segments.length
    ? new Set(job.segments.map(s => s.speaker)).size
    : 0;

  const statusClass =
    job.status === 'done' ? styles.jobCardDone :
    job.status === 'failed' ? styles.jobCardFailed :
    job.status === 'processing' ? styles.jobCardProcessing : '';

  const statusIconWrap =
    job.status === 'done' ? styles.statusIconDone :
    job.status === 'failed' ? styles.statusIconFailed :
    job.status === 'processing' ? styles.statusIconProcessing :
    styles.statusIconQueued;

  const statusLabel =
    job.status === 'queued' ? 'Queued' :
    job.status === 'processing' ? 'Processing...' :
    job.status === 'done' ? 'Done' : 'Failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={`${styles.jobCard} ${statusClass}`}>
        <div className={styles.jobInner}>
          <div className={styles.jobRow}>
            <div className={`${styles.statusIconWrap} ${statusIconWrap}`}>
              {job.status === 'done' && <CheckCircle2 className={styles.statusIcon} />}
              {job.status === 'failed' && <XCircle className={`${styles.statusIcon} ${styles.statusIconDestructive}`} />}
              {job.status === 'processing' && <Loader2 className={styles.statusIconProcessingIcon} />}
              {job.status === 'queued' && <FileAudio className={`${styles.statusIcon} ${styles.statusIconMuted}`} />}
            </div>

            <div className={styles.jobBody}>
              <div className={styles.jobTitleRow}>
                <p className={styles.jobName}>{job.file.name}</p>
                <Badge variant="outline" className={styles.jobStatusBadge}>
                  {statusLabel}
                </Badge>
              </div>

              {job.status === 'processing' && (
                <div className={styles.jobProgressWrap}>
                  <Progress value={job.progress} className={styles.jobProgress} />
                </div>
              )}

              {job.status === 'done' && (
                <div className={styles.jobMeta}>
                  <span className={styles.metaItem}>
                    <Clock className={styles.iconXs} />
                    {job.segments.length} segments
                  </span>
                  <span className={styles.metaItem}>
                    <User className={styles.iconXs} />
                    {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {job.status === 'failed' && (
                <p className={styles.jobError}>{job.error}</p>
              )}

              {job.status === 'done' && job.skippedChunks.length > 0 && (
                <p className={styles.skipWarn}>
                  <AlertTriangle className={styles.skipWarnIcon} />
                  {job.skippedChunks.length} chunk{job.skippedChunks.length !== 1 ? 's' : ''} failed (likely quota) — audio at {job.skippedChunks
                    .sort((a, b) => a - b)
                    .map(i => `[${formatTime(i * chunkDuration)} – ${formatTime((i + 1) * chunkDuration)}]`)
                    .join(', ')} may be missing
                </p>
              )}

              {job.status === 'done' && job.segments.length > 0 && (
                <p className={styles.previewSnippet}>
                  &ldquo;{job.segments[0].text}&rdquo;
                </p>
              )}
            </div>

            {job.status === 'done' && (
              <div className={styles.downloadBtns}>
                {(['txt', 'srt', 'md'] as const).map(fmt => (
                  <Button
                    key={fmt}
                    variant="ghost"
                    size="sm"
                    className={styles.downloadBtn}
                    onClick={() => onDownload(fmt)}
                  >
                    <Download className={styles.iconXs} />
                    {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
