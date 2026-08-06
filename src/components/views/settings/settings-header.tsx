'use client';

import { Cpu, Sparkles, Gauge } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './settings-view.module.css';

interface SettingsHeaderProps {
  mainSectionTab: 'config' | 'advanced';
  onTabChange: (tab: 'config' | 'advanced') => void;
}

export function SettingsHeader({ mainSectionTab, onTabChange }: SettingsHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.glowBlob} />
      <div className={styles.glowBlob2} />
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconWrap}>
            <Cpu className={styles.headerIcon} />
          </div>
          <div>
            <h1 className={styles.titleRow}>Settings Center</h1>
            <p className={styles.dialogDesc}>
              Configure AI engine credentials, audio slicing parameters, and system maintenance.
            </p>
          </div>
        </div>

        <div className={styles.headerTabsWrap}>
          <Tabs value={mainSectionTab} onValueChange={v => onTabChange(v as 'config' | 'advanced')}>
            <TabsList className={styles.headerTabsList}>
              <TabsTrigger value="config" className={styles.headerTabBtn}>
                <Sparkles className={styles.iconXs} /> AI Engine
              </TabsTrigger>
              <TabsTrigger value="advanced" className={styles.headerTabBtn}>
                <Gauge className={styles.iconXs} /> Advanced
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
