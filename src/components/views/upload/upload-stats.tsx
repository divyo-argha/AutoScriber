import { Card } from '@/components/ui/card';
import styles from './upload-area.module.css';

const STATS = [
  { value: '∞', label: 'Batch Files' },
  { value: 'BN+EN', label: 'Bangla-English Mixed' },
  { value: '5+', label: 'Export Formats' },
];

export function UploadStats() {
  return (
    <div className={styles.statsGrid}>
      {STATS.map(stat => (
        <Card key={stat.label} className={styles.statCard}>
          <p className={styles.statValue}>{stat.value}</p>
          <p className={styles.statLabel}>{stat.label}</p>
        </Card>
      ))}
    </div>
  );
}
