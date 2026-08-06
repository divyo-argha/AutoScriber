'use client';

import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import styles from './audio-player.module.css';

const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: 'Play/Pause', keys: ['Space'] },
  { label: 'Skip Forward/Back', keys: ['←', '→'] },
  { label: 'Previous/Next Segment', keys: ['Shift+←', 'Shift+→'] },
  { label: 'Volume Up/Down', keys: ['↑', '↓'] },
  { label: 'Mute', keys: ['M'] },
  { label: 'Cycle Loop Mode', keys: ['L'] },
  { label: 'Cycle Speed', keys: ['S'] },
  { label: 'Toggle Expanded', keys: ['F'] },
  { label: 'Restart', keys: ['0'] },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.overlay}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={styles.modalCard}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <Keyboard className={styles.modalTitleIcon} />
            Keyboard Shortcuts
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className={styles.modalCloseBtn}>
            ✕
          </Button>
        </div>
        <div className={styles.modalBody}>
          {SHORTCUTS.map(shortcut => (
            <div key={shortcut.label} className={styles.shortcutRow}>
              <span className={styles.shortcutLabel}>{shortcut.label}</span>
              <div className={styles.shortcutKeys}>
                {shortcut.keys.map(key => (
                  <kbd key={key} className={styles.kbd}>{key}</kbd>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.shortcutRowNoBorder}>
            <span className={styles.shortcutLabel}>Show Shortcuts</span>
            <kbd className={styles.kbd}>?</kbd>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
