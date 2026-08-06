import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { XCircle, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import type { JobRecord } from '@/lib/api';
import { formatDate } from './completed-job-card';
import styles from './history-view.module.css';

interface OtherJobCardProps {
  job: JobRecord;
  deleting: boolean;
  onDelete: () => void;
}

export function OtherJobCard({ job, deleting, onDelete }: OtherJobCardProps) {
  const isFailed = job.status === 'failed';

  return (
    <Card className={styles.fadedCard}>
      <div className={styles.otherRow}>
        <div className={`${styles.jobIconWrap} ${styles.jobIconWrapMuted}`}>
          {isFailed ? (
            <XCircle className={`${styles.jobIcon} ${styles.jobIconDestructive}`} />
          ) : (
            <AlertTriangle className={`${styles.jobIcon} ${styles.jobIconAmber}`} />
          )}
        </div>
        <div className={styles.jobBody}>
          <p className={styles.jobName}>{job.fileName}</p>
          <div className={styles.otherMeta}>
            <Badge variant="outline" className={styles.otherStatus}>{job.status}</Badge>
            <span className={styles.otherDate}>{formatDate(job.createdAt)}</span>
          </div>
          {job.errorMessage && (
            <p className={styles.otherError}>{job.errorMessage}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`${styles.iconBtnDanger} ${styles.shrink}`}
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className={`${styles.iconSm} ${styles.spinIcon}`} /> : <Trash2 className={styles.iconSm} />}
        </Button>
      </div>
    </Card>
  );
}
