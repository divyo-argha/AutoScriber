'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Settings, Mic, RotateCcw, History, Brain, AlertTriangle } from 'lucide-react';
import { SettingsDialog } from './settings-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';

export function Header() {
  const {
    currentView,
    setCurrentView,
    selectedModel,
    setSelectedModel,
    userGeminiApiKey,
    geminiApiKey,
    reset,
    isProcessing,
  } = useAppStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  const hasGeminiKey = !!(userGeminiApiKey || geminiApiKey === '***');

  function isModelAvailable(model: typeof AVAILABLE_MODELS[number]) {
    if (model.provider === 'gemini') return hasGeminiKey;
    return false;
  }

  const ModelOption = ({ model }: { model: typeof AVAILABLE_MODELS[number] }) => {
    const available = isModelAvailable(model);
    return (
      <div className="flex items-center gap-2 w-full">
        <span className={available ? '' : 'text-muted-foreground'}>{model.name}</span>
        {!available && (
          <span title="API key not set — configure in Settings" className="shrink-0 ml-auto flex items-center">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => { if (!isProcessing) { reset(); setCurrentView('upload'); } }}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">autoScriber</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Bangla Audio Transcription</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isProcessing}>
                <SelectTrigger className="w-[220px]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name ?? selectedModel}</span>
                    {!isModelAvailable(AVAILABLE_MODELS.find(m => m.id === selectedModel)!) && (
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <ModelOption model={model} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {currentView !== 'upload' && currentView !== 'history' && currentView !== 'thematic' && !isProcessing && (
                <Button variant="outline" size="sm" onClick={() => { reset(); setCurrentView('upload'); }} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              )}
              <Button
                variant={currentView === 'thematic' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView(currentView === 'thematic' ? 'upload' : 'thematic')}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Analysis</span>
              </Button>
              <Button
                variant={currentView === 'history' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView(currentView === 'history' ? 'upload' : 'history')}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} disabled={isProcessing}>
                <Settings className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>

          {/* Mobile model selector */}
          <div className="sm:hidden pb-3">
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isProcessing}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="truncate">{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name ?? selectedModel}</span>
                  {!isModelAvailable(AVAILABLE_MODELS.find(m => m.id === selectedModel)!) && (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <ModelOption model={model} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
