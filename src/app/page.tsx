'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ViewRouter } from '@/components/views';
import styles from './home.module.css';

export default function Home() {
  const { setCurrentView, setSettings, setHistoryJobs, setProcessingState } = useAppStore();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSettings({
              chunkDuration: typeof data.chunkDuration === 'number' ? data.chunkDuration : 300,
              overlapDuration: typeof data.overlapDuration === 'number' ? data.overlapDuration : 30,
              geminiApiKey: data.geminiApiKey ?? '',
              userGeminiApiKey: data.userGeminiApiKey || '',
            });
          }
        }
      } catch {}
    };

    const loadHistoryAndCheckActiveJob = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && Array.isArray(data.jobs)) {
            setHistoryJobs(data.jobs.map((job: Record<string, unknown>) => ({
              id: job.id as string,
              fileName: job.fileName as string,
              fileSize: job.fileSize as number,
              duration: job.duration as number | null,
              status: job.status as string,
              model: job.model as string,
              createdAt: job.createdAt as string,
              segmentsCount: job.result ? JSON.parse(job.result as string).segments?.length || 0 : 0,
              speakersCount: job.result ? new Set(JSON.parse(job.result as string).segments?.map((s: Record<string, unknown>) => s.speaker)).size : 0,
            })));

            // Restore active/in-flight transcription if user reloaded or navigated back
            const storedJobId = typeof window !== 'undefined' ? localStorage.getItem('autoscribe_active_job_id') : null;
            const activeJob = data.jobs.find((j: Record<string, unknown>) =>
              j.id === storedJobId || ['pending', 'uploading', 'chunking', 'processing', 'paused'].includes(j.status as string)
            );

            if (activeJob && ['pending', 'uploading', 'chunking', 'processing', 'paused'].includes(activeJob.status as string)) {
              setProcessingState({
                isProcessing: true,
                jobId: activeJob.id as string,
                processingProgress: (activeJob.progress as number) ?? 0,
                chunksTotal: (activeJob.chunksTotal as number) ?? 0,
                chunksDone: (activeJob.chunksDone as number) ?? 0,
                processingStatus: (activeJob.controlStatus as string) === 'paused' ? 'Paused — press Resume to continue' : 'Transcribing audio...',
              });
              setCurrentView('processing');
            }
          }
        }
      } catch {}
    };

    loadSettings();
    loadHistoryAndCheckActiveJob();
  }, [setSettings, setHistoryJobs, setProcessingState, setCurrentView]);

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        <ViewRouter />
      </main>

      <Footer />
    </div>
  );
}
