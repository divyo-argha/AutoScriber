import { Card } from '@/components/ui/card';
import { Files, Languages, FileDown } from 'lucide-react';
import styles from './upload-area.module.css';

const STATS = [
  { icon: Files, value: '∞', label: 'Batch Files' },
  { icon: Languages, value: 'BN+EN', label: 'Bangla-English Mixed' },
  { icon: FileDown, value: '5+', label: 'Export Formats' },
];

export function UploadStats() {
  return (
    <div className={styles.statsGrid}>
      {STATS.map(stat => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className={styles.statCard}>
            <Icon className={styles.statIcon} />
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statLabel}>{stat.label}</p>
          </Card>
        );
      })}
    </div>
  );
}
