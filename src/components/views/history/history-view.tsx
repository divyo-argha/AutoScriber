'use client';

import { useRouter } from 'next/navigation';
import { useHistoryView } from './use-history-view';
import { HistoryHeader } from './history-header';
import { HistoryLoading, HistoryEmpty } from './history-states';
import { CompletedJobCard } from './completed-job-card';
import { OtherJobCard } from './other-job-card';
import styles from './history-view.module.css';

export function HistoryView() {
  const router = useRouter();
  const {
    loading,
    jobs,
    expandedJob,
    deleting,
    completedJobs,
    otherJobs,
    loadJobs,
    loadJob,
    deleteJobById,
    exportFromHistory,
    toggleExpanded,
  } = useHistoryView();

  return (
    <div className={styles.root}>
      <HistoryHeader
        completedCount={completedJobs.length}
        loading={loading}
        onRefresh={loadJobs}
      />

      {loading && jobs.length === 0 ? (
        <HistoryLoading />
      ) : jobs.length === 0 ? (
        <HistoryEmpty onStart={() => router.push('/')} />
      ) : (
        <div className={styles.jobsGroup}>
          {completedJobs.length > 0 && (
            <div className={styles.groupInner}>
              <h3 className={styles.groupTitle}>Completed</h3>
              {completedJobs.map((job, i) => (
                <CompletedJobCard
                  key={job.id}
                  job={job}
                  index={i}
                  expanded={expandedJob === job.id}
                  deleting={deleting === job.id}
                  onToggle={() => toggleExpanded(job.id)}
                  onView={() => loadJob(job.id)}
                  onDelete={() => deleteJobById(job.id)}
                  onExport={(format) => exportFromHistory(job, format)}
                />
              ))}
            </div>
          )}

          {otherJobs.length > 0 && (
            <div className={styles.groupInner}>
              <h3 className={styles.groupTitle}>Other</h3>
              {otherJobs.map((job) => (
                <OtherJobCard
                  key={job.id}
                  job={job}
                  deleting={deleting === job.id}
                  onDelete={() => deleteJobById(job.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
