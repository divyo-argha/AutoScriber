'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/app/header';
import { UploadArea } from '@/components/app/upload-area';
import { ProcessingView } from '@/components/app/processing-view';
import { TranscriptionViewer } from '@/components/app/transcription-viewer';
import { HistoryView } from '@/components/app/history-view';
import { BatchView } from '@/components/app/batch-view';
import { Footer } from '@/components/app/footer';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { currentView, setSettings, setOllamaModels, setHistoryJobs } = useAppStore();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSettings({
              ollamaUrl: data.ollamaUrl || 'http://localhost:11434',
              chunkDuration: data.chunkDuration || 300,
              overlapDuration: data.overlapDuration || 10,
            });
          }
        }
      } catch {}
    };

    const loadOllamaModels = async () => {
      try {
        const res = await fetch('/api/models?ollamaUrl=http://localhost:11434');
        if (res.ok) {
          const data = await res.json();
          if (data.ollamaModels) {
            setOllamaModels(data.ollamaModels);
          }
        }
      } catch {}
    };

    const loadHistory = async () => {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) {
          const data = await res.json();
          if (data.jobs) {
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
          }
        }
      } catch {}
    };

    loadSettings();
    loadOllamaModels();
    loadHistory();
  }, [setSettings, setOllamaModels, setHistoryJobs]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {currentView === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="text-center space-y-3 max-w-2xl mx-auto"
              >
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Transcribe Your Bangla Audio
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                  Upload an audio file or record directly from your browser. Get accurate Bangla-English mixed transcriptions with
                  timestamps and speaker diarization. Built for researchers.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
              >
                <UploadArea />
              </motion.div>
            </motion.div>
          )}

          {currentView === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ProcessingView />
            </motion.div>
          )}

          {currentView === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <TranscriptionViewer />
            </motion.div>
          )}

          {currentView === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <HistoryView />
            </motion.div>
          )}

          {currentView === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <BatchView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
