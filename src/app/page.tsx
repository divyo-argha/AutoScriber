'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/app/header';
import { UploadArea } from '@/components/app/upload-area';
import { ProcessingView } from '@/components/app/processing-view';
import { TranscriptionViewer } from '@/components/app/transcription-viewer';
import { Footer } from '@/components/app/footer';

export default function Home() {
  const { currentView, setSettings, setOllamaModels } = useAppStore();
  
  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSettings({
              geminiApiKey: data.geminiApiKey || '',
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
    
    loadSettings();
    loadOllamaModels();
  }, [setSettings, setOllamaModels]);
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'upload' && (
          <div className="space-y-8">
            {/* Hero Section - Only shown on upload view */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Transcribe Your Bangla Audio
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                Upload audio files and get accurate Bangla-English mixed transcriptions with 
                timestamps and speaker diarization. Built for researchers.
              </p>
            </div>
            
            <UploadArea />
          </div>
        )}
        {currentView === 'processing' && <ProcessingView />}
        {currentView === 'result' && <TranscriptionViewer />}
      </main>
      
      <Footer />
    </div>
  );
}
