'use client';

import styles from './settings-view.module.css';

interface ChunkPresetButtonsProps {
  value: string;
  onSelect: (value: string) => void;
  presets: { label: string; val: string }[];
}

/** Reusable pill-style preset selector used by the chunk settings card. */
export function ChunkPresetButtons({ value, onSelect, presets }: ChunkPresetButtonsProps) {
  return (
    <div className={styles.presetRow}>
      {presets.map(preset => (
        <button
          key={preset.val}
          type="button"
          onClick={() => onSelect(preset.val)}
          className={`${styles.presetBtn} ${value === preset.val ? styles.presetBtnActive : ''}`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
