'use client';

import { motion } from 'framer-motion';
import styles from './sound-wave-indicator.module.css';

interface SoundWaveIndicatorProps {
  audioLevel: number;
  isActive: boolean;
}

export function SoundWaveIndicator({ audioLevel, isActive }: SoundWaveIndicatorProps) {
  const bars = 5;

  return (
    <div className={styles.container}>
      {Array.from({ length: bars }).map((_, i) => {
        const height = isActive ? Math.max(20, audioLevel * 100 * (0.5 + Math.random() * 0.5)) : 20;
        return (
          <motion.div
            key={i}
            className={styles.bar}
            animate={{
              height: isActive ? `${height}%` : '20%',
              opacity: isActive ? 1 : 0.3,
            }}
            transition={{
              duration: 0.15,
              ease: 'easeOut',
            }}
          />
        );
      })}
    </div>
  );
}