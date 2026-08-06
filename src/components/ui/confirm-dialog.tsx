'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';
import styles from './confirm-dialog.module.css';

type Tone = 'danger' | 'warning' | 'brand';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  icon?: ReactNode;
  loading?: boolean;
  onConfirm: () => void;
  showCloseButton?: boolean;
}

/**
 * Reusable, polished confirmation/alert modal. Replaces native `confirm()` /
 * `alert()` with a branded overlay dialog for a consistent, premium feel.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'brand',
  icon,
  loading = false,
  onConfirm,
  showCloseButton = true,
}: ConfirmDialogProps) {
  const toneGlow = tone === 'danger' ? styles.glowDanger : tone === 'warning' ? styles.glowWarning : styles.glowBrand;
  const toneIconWrap = tone === 'danger' ? styles.iconWrapDanger : tone === 'warning' ? styles.iconWrapWarning : styles.iconWrapBrand;
  const toneIcon = tone === 'danger' ? styles.iconDanger : tone === 'warning' ? styles.iconWarning : styles.iconBrand;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content} showCloseButton={showCloseButton}>
        <div className={`${styles.glow} ${toneGlow}`} />
        <div className={styles.inner}>
          <div className={`${styles.iconWrap} ${toneIconWrap}`}>
            {icon ?? <AlertTriangle className={`${styles.icon} ${toneIcon}`} />}
          </div>
          <DialogHeader>
            <DialogTitle className={styles.title}>{title}</DialogTitle>
            <DialogDescription className={styles.description}>{description}</DialogDescription>
          </DialogHeader>
          <div className={styles.footer}>
            <Button
              variant="outline"
              className={styles.cancelButton}
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={tone === 'danger' ? 'destructive' : 'brand'}
              className={styles.confirmButton}
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
              disabled={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
