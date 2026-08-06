import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, FileType2, FileDown, Sparkles, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './transcription-viewer.module.css';

export type ExportFormat = 'txt' | 'md' | 'srt' | 'docx' | 'pdf';

interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: ReactNode;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { format: 'txt', label: 'TXT', icon: <FileText className={styles.iconSm} /> },
  { format: 'md', label: 'Markdown', icon: <FileType2 className={styles.iconSm} /> },
  { format: 'srt', label: 'SRT', icon: <FileText className={styles.iconSm} /> },
  { format: 'docx', label: 'DOCX', icon: <FileDown className={styles.iconSm} /> },
  { format: 'pdf', label: 'PDF', icon: <FileDown className={styles.iconSm} /> },
];

interface ExportCardProps {
  exportingFormat: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
}

export function ExportCard({ exportingFormat, onExport }: ExportCardProps) {
  return (
    <Card className={styles.exportCard}>
      <div className={styles.exportInner}>
        <div className={styles.exportHeader}>
          <div className={styles.exportIconWrap}>
            <Sparkles className={styles.exportIcon} />
          </div>
          <div>
            <h3 className={styles.exportTitle}>Export & Transcribe History</h3>
            <p className={styles.exportSub}>Download formatted transcripts or sync options</p>
          </div>
        </div>
        <Separator className={styles.exportDivider} />
        <div className={styles.exportGrid}>
          {EXPORT_OPTIONS.map(({ format, label, icon }) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              onClick={() => onExport(format)}
              disabled={exportingFormat !== null}
              className={styles.exportBtn}
            >
              {exportingFormat === format ? (
                <Loader2 className={styles.exportSpinner} />
              ) : (
                <span className={styles.exportBtnIcon}>{icon}</span>
              )}
              {label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
