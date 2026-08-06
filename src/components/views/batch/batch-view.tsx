'use client';

import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { AnimatePresence } from 'framer-motion';
import { useBatchQueue } from './use-batch-queue';
import { BatchHeader } from './batch-header';
import { BatchJobCard } from './batch-job-card';
import { BatchDoneBanner } from './batch-done-banner';
import styles from './batch-view.module.css';

export function BatchView() {
  const router = useRouter();
  const {
    batchJobs,
    chunkDuration,
    doneCount,
    failedCount,
    totalCount,
    anyActive,
    allFinished,
    downloadOne,
    downloadAll,
    stopBatch,
    clearBatch,
  } = useBatchQueue();

  return (
    <div className={styles.root}>
      <BatchHeader
        doneCount={doneCount}
        totalCount={totalCount}
        failedCount={failedCount}
        anyActive={anyActive}
        allFinished={allFinished}
        downloadAllDisabled={false}
        onStop={stopBatch}
        onDownloadAll={downloadAll}
        onNewBatch={() => { clearBatch(); router.push('/'); }}
      />

      {!allFinished && (
        <Progress value={Math.round((doneCount + failedCount) / totalCount * 100)} className={styles.overallBar} />
      )}

      <div className={styles.jobList}>
        <AnimatePresence initial={false}>
          {batchJobs.map((job, idx) => (
            <BatchJobCard
              key={job.id}
              job={job}
              index={idx}
              chunkDuration={chunkDuration}
              onDownload={(format) => downloadOne(job.id, format)}
            />
          ))}
        </AnimatePresence>
      </div>

      {allFinished && doneCount > 1 && (
        <BatchDoneBanner doneCount={doneCount} onDownloadAll={downloadAll} />
      )}
    </div>
  );
}
