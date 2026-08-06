'use client';

import { Download, Keyboard, Maximize2, Minimize2, Settings, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import styles from './audio-player.module.css';

interface PlayerTopBarProps {
  segmentsCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleShortcuts: () => void;
  onToggleSettings: () => void;
  onShare: () => void;
  onDownload: () => void;
}

export function PlayerTopBar({
  segmentsCount,
  isExpanded,
  onToggleExpanded,
  onToggleShortcuts,
  onToggleSettings,
  onShare,
  onDownload,
}: PlayerTopBarProps) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleShortcuts}
          className={styles.iconBtn}
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className={styles.iconMd} />
        </Button>
        {segmentsCount > 0 && (
          <Badge variant="outline" className={styles.segmentsBadge}>
            {segmentsCount} segments
          </Badge>
        )}
      </div>
      <div className={styles.topBarRight}>
        <Button variant="ghost" size="icon" onClick={onShare} className={styles.iconBtn} title="Share timestamp">
          <Share2 className={styles.iconMd} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDownload} className={styles.iconBtn} title="Download audio">
          <Download className={styles.iconMd} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleExpanded}
          className={styles.iconBtn}
          title="Toggle expanded view (F)"
        >
          {isExpanded ? <Minimize2 className={styles.iconMd} /> : <Maximize2 className={styles.iconMd} />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleSettings} className={styles.iconBtn} title="Settings">
          <Settings className={styles.iconMd} />
        </Button>
      </div>
    </div>
  );
}
