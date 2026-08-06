import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, Copy, CheckCircle2, Headphones, List } from 'lucide-react';
import styles from './transcription-viewer.module.css';

export type ViewMode = 'player' | 'list';

interface StatsBarProps {
  segmentCount: number;
  speakerCount: number;
  jobId: string | null;
  viewMode: ViewMode;
  copied: boolean;
  onCopy: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function StatsBar({ segmentCount, speakerCount, jobId, viewMode, copied, onCopy, onViewModeChange }: StatsBarProps) {
  return (
    <div className={styles.statsBar}>
      <div className={styles.statGroup}>
        <Badge variant="outline" className={styles.statBadge}>
          <Clock className={styles.statIcon} />
          {segmentCount} segments
        </Badge>
        <Badge variant="outline" className={styles.statBadge}>
          <User className={styles.statIcon} />
          {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
        </Badge>
        {jobId && (
          <Badge variant="outline" className={styles.savedBadge}>
            Saved in history
          </Badge>
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.modeSwitch}>
        <Button
          variant={viewMode === 'player' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('player')}
          className={`${styles.modeBtn} ${viewMode === 'player' ? styles.modeBtnActive : styles.modeBtnInactive}`}
        >
          <Headphones className={styles.iconSm} />
          Focus view
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('list')}
          className={`${styles.modeBtn} ${viewMode === 'list' ? styles.modeBtnActive : styles.modeBtnInactive}`}
        >
          <List className={styles.iconSm} />
          Full Transcript
        </Button>
      </div>

      <div className={styles.actionsGroup}>
        <Button variant="outline" size="sm" onClick={onCopy} className={styles.actionBtn}>
          {copied ? <CheckCircle2 className={styles.copyIcon} /> : <Copy className={styles.iconSm} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
