import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';
import styles from './upload-area.module.css';

interface TabCardProps extends Omit<ComponentProps<typeof Card>, 'children'> {
  children: ReactNode;
}

/**
 * Shared outer shell for every upload-source tab (Upload, ZIP, Folder,
 * Drive, Record). Guarantees a consistent height, centering and padding so
 * all tabs render as equal-sized cards regardless of inner content.
 */
export function TabCard({ children, className, ...props }: TabCardProps) {
  return (
    <Card className={cn(styles.tabCard, className)} {...props}>
      <div className={styles.tabCardInner}>{children}</div>
    </Card>
  );
}
