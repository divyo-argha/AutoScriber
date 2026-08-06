'use client';

import { Gauge, Loader2, Radio, RotateCcw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChunkPresetButtons } from './chunk-preset-buttons';
import styles from './settings-view.module.css';

interface AdvancedTabProps {
  localChunkDuration: string;
  onChunkDurationChange: (value: string) => void;
  localOverlapDuration: string;
  onOverlapDurationChange: (value: string) => void;
  onReset: () => void;
  cleaningStorage: boolean;
  onCleanupStorage: () => void;
}

const CHUNK_PRESETS = [
  { label: '3 Min', val: '180' },
  { label: '5 Min (Default)', val: '300' },
  { label: '10 Min', val: '600' },
];

const OVERLAP_PRESETS = [
  { label: '15s', val: '15' },
  { label: '30s (Default)', val: '30' },
  { label: '45s', val: '45' },
];

export function AdvancedTab({
  localChunkDuration,
  onChunkDurationChange,
  localOverlapDuration,
  onOverlapDurationChange,
  onReset,
  cleaningStorage,
  onCleanupStorage,
}: AdvancedTabProps) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon} style={{ color: 'var(--brand-400)' }}>
            <Gauge className={styles.iconMd} />
          </div>
          <div>
            <p className={styles.cardTitle}>Audio Slicing & Chunk Settings</p>
            <p className={styles.cardDesc}>Configure chunk lengths & overlap duration for high-accuracy transcription.</p>
          </div>
        </div>

        <div className={styles.advGrid} style={{ marginTop: '1rem' }}>
          <div className={styles.advCol}>
            <Label className={styles.advLabel}>Chunk Duration (seconds)</Label>
            <div className={styles.advInputWrap}>
              <Input type="number" min="60" max="3600" value={localChunkDuration} onChange={e => onChunkDurationChange(e.target.value)} className={styles.advInput} />
              <span className={styles.advUnit}>sec</span>
            </div>
            <ChunkPresetButtons value={localChunkDuration} onSelect={onChunkDurationChange} presets={CHUNK_PRESETS} />
            <p className={styles.advHint} style={{ marginTop: '0.375rem' }}>Long audio is split into chunks of this size for high accuracy.</p>
          </div>
          <div className={styles.advCol}>
            <Label className={styles.advLabel}>Overlap Duration (seconds)</Label>
            <div className={styles.advInputWrap}>
              <Input type="number" min="0" max="60" value={localOverlapDuration} onChange={e => onOverlapDurationChange(e.target.value)} className={styles.advInput} />
              <span className={styles.advUnit}>sec</span>
            </div>
            <ChunkPresetButtons value={localOverlapDuration} onSelect={onOverlapDurationChange} presets={OVERLAP_PRESETS} />
            <p className={styles.advHint} style={{ marginTop: '0.375rem' }}>Overlap between chunks avoids cutting words mid-sentence.</p>
          </div>
        </div>

        <div className={styles.advFooter} style={{ marginTop: '1rem' }}>
          <span className={styles.advSummaryNote}>
            <Radio className={styles.iconXs} /> Applies to all future transcription jobs.
          </span>
          <button type="button" onClick={onReset} className={styles.advResetBtn}>
            <RotateCcw className={styles.iconXs} /> Reset to defaults
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon} style={{ color: 'var(--destructive)' }}>
            <Trash2 className={styles.iconMd} />
          </div>
          <div>
            <p className={styles.cardTitle}>Storage Maintenance & Cleanup</p>
            <p className={styles.cardDesc}>Purge unused or orphaned audio files from disk to free up space.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
          <p className={styles.advHint} style={{ margin: 0 }}>
            Safely deletes temporary files from deleted or old jobs in <code className={styles.credCode}>data/audio/</code>.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onCleanupStorage}
            disabled={cleaningStorage}
            style={{ gap: '0.5rem' }}
          >
            {cleaningStorage ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Trash2 className={styles.iconSm} />}
            Clean Storage
          </Button>
        </div>
      </div>
    </div>
  );
}
