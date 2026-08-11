'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useHistoryView } from './use-history-view';
import { HistoryHeader } from './history-header';
import { HistoryLoading, HistoryEmpty } from './history-states';
import { CompletedJobCard } from './completed-job-card';
import { OtherJobCard } from './other-job-card';
import { FailedJobCard } from './failed-job-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { JobRecord } from './use-history-view';
import styles from './history-view.module.css';

type Tab = 'completed' | 'failed';

export function HistoryView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('completed');
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  const {
    loading,
    jobs,
    expandedJob,
    deleting,
    confirmDeleteJob,
    completedJobs,
    failedJobs,
    otherJobs,
    loadJobs,
    loadJob,
    requestDelete,
    confirmDelete,
    cancelDelete,
    exportFromHistory,
    recoverPartial,
    resumeJob,
    toggleExpanded,
  } = useHistoryView();

  const handleRecover = async (job: JobRecord) => {
    setRecoveringId(job.id);
    try {
      await recoverPartial(job);
    } finally {
      setRecoveringId(null);
    }
  };

  const hasAnyJobs = jobs.length > 0;
  const totalFailed = failedJobs.length;
  const totalCompleted = completedJobs.length;

  return (
    <div className={styles.root}>
      <HistoryHeader
        completedCount={totalCompleted}
        loading={loading}
        onRefresh={loadJobs}
      />

      {loading && jobs.length === 0 ? (
        <HistoryLoading />
      ) : !hasAnyJobs ? (
        <HistoryEmpty onStart={() => router.push('/app')} />
      ) : (
        <>
          {/* In-progress jobs always shown above tabs */}
          {otherJobs.length > 0 && (
            <div className={styles.groupInner}>
              <h3 className={styles.groupTitle}>In Progress</h3>
              {otherJobs.map((job) => (
                <OtherJobCard
                  key={job.id}
                  job={job}
                  deleting={deleting === job.id}
                  onDelete={() => requestDelete(job)}
                />
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'completed' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed
              {totalCompleted > 0 && (
                <span className={`${styles.tabCount} ${activeTab === 'completed' ? styles.tabCountActive : ''}`}>
                  {totalCompleted}
                </span>
              )}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'failed' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('failed')}
            >
              Failed &amp; Cancelled
              {totalFailed > 0 && (
                <span className={`${styles.tabCount} ${styles.tabCountFailed} ${activeTab === 'failed' ? styles.tabCountFailedActive : ''}`}>
                  {totalFailed}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'completed' && (
            completedJobs.length === 0 ? (
              <div className={styles.tabEmpty}>
                <p className={styles.tabEmptyText}>No completed transcriptions yet.</p>
              </div>
            ) : (
              <div className={styles.groupInner}>
                {completedJobs.map((job, i) => (
                  <CompletedJobCard
                    key={job.id}
                    job={job}
                    index={i}
                    expanded={expandedJob === job.id}
                    deleting={deleting === job.id}
                    onToggle={() => toggleExpanded(job.id)}
                    onView={() => loadJob(job.id)}
                    onDelete={() => requestDelete(job)}
                    onExport={(format) => exportFromHistory(job, format)}
                  />
                ))}
              </div>
            )
          )}

          {activeTab === 'failed' && (
            failedJobs.length === 0 ? (
              <div className={styles.tabEmpty}>
                <p className={styles.tabEmptyText}>No failed or cancelled transcriptions.</p>
              </div>
            ) : (
              <div className={styles.groupInner}>
                {failedJobs.map((job, i) => (
                  <FailedJobCard
                    key={job.id}
                    job={job}
                    index={i}
                    expanded={expandedJob === job.id}
                    deleting={deleting === job.id}
                    recovering={recoveringId === job.id}
                    onToggle={() => toggleExpanded(job.id)}
                    onDelete={() => requestDelete(job)}
                    onRecover={() => handleRecover(job)}
                    onResume={() => resumeJob(job)}
                    onExport={(format) => exportFromHistory(job, format)}
                  />
                ))}
              </div>
            )
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDeleteJob}
        onOpenChange={(open) => { if (!open) cancelDelete(); }}
        title="Delete this transcription?"
        description={
          <>
            Are you sure you want to permanently remove{' '}
            <strong>{confirmDeleteJob?.fileName || 'this file'}</strong> from your history?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="danger"
        icon={<Trash2 className={`${styles.iconSm} ${styles.iconDanger}`} />}
        loading={deleting === confirmDeleteJob?.id}
        onConfirm={confirmDelete}
        showCloseButton={false}
      />
    </div>
  );
}
