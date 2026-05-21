'use client';

import { motion } from 'framer-motion';

interface SoundWaveIndicatorProps {
  audioLevel: number;
  isActive: boolean;
}

export function SoundWaveIndicator({ audioLevel, isActive }: SoundWaveIndicatorProps) {
  const bars = 5;
  
  return (
    <div className="flex items-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const height = isActive ? Math.max(20, audioLevel * 100 * (0.5 + Math.random() * 0.5)) : 20;
        return (
          <motion.div
            key={i}
            className="w-1 bg-primary rounded-full"
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
