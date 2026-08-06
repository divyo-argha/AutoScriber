import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, User, Play, Trash2, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { JobRecord } from '@/lib/api';
import styles from './history-view.module.css';

export function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPreviewTime(startTime: unknown): string {
  if (typeof startTime !== 'number') return '0:00';
  return `${Math.floor(startTime / 60)}:${Math.floor(startTime % 60).toString().padStart(2, '0')}`;
}

interface PreviewData {
  segments: Array<{ startTime?: number; speaker?: string; text?: string }>;
  speakers: number;
  segmentsCount: number;
}

function parsePreview(result: string | null): PreviewData {
  if (!result) return { segments: [], speakers: 0, segmentsCount: 0 };
  try {
    const data = JSON.parse(result) as { segments?: Array<{ startTime?: number; speaker?: string; text?: string }> };
    const segments = data.segments || [];
    const speakers = new Set(segments.map(s => s.speaker)).size;
    return { segments, speakers, segmentsCount: segments.length };
  } catch {
    return { segments: [], speakers: 0, segmentsCount: 0 };
  }
}

interface CompletedJobCardProps {
  job: JobRecord;
  index: number;
  expanded: boolean;
  deleting: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
  onExport: (format: 'txt' | 'md' | 'srt') => void;
}

export function CompletedJobCard({ job, index, expanded, deleting, onToggle, onView, onDelete, onExport }: CompletedJobCardProps) {
  const preview = parsePreview(job.result);
  const { speakers, segmentsCount } = preview;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className={styles.jobCard}>
        <div className={styles.jobHeader} onClick={onToggle}>
          <div className={styles.jobRow}>
            <div className={styles.jobIconWrap}>
              <CheckCircle2 className={styles.jobIcon} />
            </div>
            <div className={styles.jobBody}>
              <div className={styles.jobTitleRow}>
                <p className={styles.jobName}>{job.fileName}</p>
                <Badge variant="outline" className={styles.jobModelBadge}>
                  {job.model}
                </Badge>
              </div>
              <div className={styles.jobMeta}>
                <span className={styles.metaItem}>
                  <Clock className={styles.iconXs} />
                  {formatDuration(job.duration)}
                </span>
                <span>{formatBytes(job.fileSize)}</span>
                <span>{segmentsCount} segments</span>
                <span className={styles.metaItem}>
                  <User className={styles.iconXs} />
                  {speakers} speaker{speakers !== 1 ? 's' : ''}
                </span>
              </div>
              <p className={styles.jobDate}>
                {formatDate(job.createdAt)}
              </p>
            </div>
            <div className={styles.jobActions}>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onView(); }} className={styles.viewBtn}>
                <Play className={styles.iconXs} />
                View
              </Button>
              <Button variant="ghost" size="icon" className={styles.iconBtnDanger} onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={deleting}>
                {deleting ? <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} /> : <Trash2 className={styles.iconSm} />}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && preview.segments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.previewWrap}
            >
              <div className={styles.previewInner}>
                <div className={styles.previewList}>
                  {preview.segments.slice(0, 10).map((seg, idx) => (
                    <div key={idx} className={styles.previewRow}>
                      <span className={styles.previewTime}>{formatPreviewTime(seg.startTime)}</span>
                      <span className={styles.previewSpeaker}>{String(seg.speaker)}:</span>
                      <span className={styles.previewText}>{seg.text}</span>
                    </div>
                  ))}
                  {preview.segments.length > 10 && (
                    <p className={styles.previewMore}>
                      ...and {preview.segments.length - 10} more segments. Click "View" to see full transcription.
                    </p>
                  )}
                </div>
                <div className={styles.exportRow}>
                  <span className={styles.exportLabel}>
                    <Download className={styles.iconXs} />
                    Quick export:
                  </span>
                  {(['txt', 'md', 'srt'] as const).map(format => (
                    <Button key={format} variant="ghost" size="sm" className={styles.exportBtn} onClick={(e) => { e.stopPropagation(); onExport(format); }}>
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
