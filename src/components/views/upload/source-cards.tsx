import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './upload-area.module.css';

interface SourceCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonIcon: ReactNode;
  onButtonClick: () => void;
  extra?: ReactNode;
}

export function SourceCard({ icon, title, subtitle, buttonLabel, buttonIcon, onButtonClick, extra }: SourceCardProps) {
  return (
    <Card className={styles.dropZone}>
      <div className={styles.dropInner}>
        {icon}
        <div>
          <p className={styles.dropTitle}>{title}</p>
          <p className={styles.dropSubtitle}>{subtitle}</p>
        </div>
        <Button variant="outline" onClick={onButtonClick} className={styles.gap2}>
          {buttonIcon} {buttonLabel}
        </Button>
        {extra}
      </div>
    </Card>
  );
}

export function ZipCard({ onChooseZip }: { onChooseZip: () => void }) {
  return (
    <SourceCard
      icon={
        <div className={styles.sourceIconWrap}>
          <Archive className={styles.sourceIcon} />
        </div>
      }
      title="Upload ZIP file"
      subtitle="Extracts audio files recursively"
      buttonLabel="Choose ZIP"
      buttonIcon={<Archive className={styles.iconMd} />}
      onButtonClick={onChooseZip}
    />
  );
}

export function FolderCard({ onChooseFolder }: { onChooseFolder: () => void }) {
  return (
    <SourceCard
      icon={
        <div className={styles.sourceIconWrap}>
          <FolderOpen className={styles.sourceIcon} />
        </div>
      }
      title="Select folder"
      subtitle="Scans recursively for audio files"
      buttonLabel="Choose Folder"
      buttonIcon={<FolderOpen className={styles.iconMd} />}
      onButtonClick={onChooseFolder}
    />
  );
}
