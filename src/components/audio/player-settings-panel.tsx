'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import styles from './audio-player.module.css';

interface PlayerSettingsPanelProps {
  skipInterval: number;
  onSkipIntervalChange: (value: number) => void;
}

const SKIP_INTERVALS = [5, 10, 15, 30];

export function PlayerSettingsPanel({ skipInterval, onSkipIntervalChange }: PlayerSettingsPanelProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={styles.settingsPanel}
    >
      <Card className={styles.settingsCard}>
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>Skip Interval</span>
          <div className={styles.skipBtns}>
            {SKIP_INTERVALS.map(interval => (
              <Button
                key={interval}
                variant={skipInterval === interval ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSkipIntervalChange(interval)}
                className={styles.skipBtn}
              >
                {interval}s
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
