'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Settings, Mic, RotateCcw, History } from 'lucide-react';
import { SettingsDialog } from './settings-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AVAILABLE_MODELS } from '@/lib/transcriber/types';

export function Header() {
  const {
    selectedModel,
    setSelectedModel,
    currentView,
    setCurrentView,
    reset,
    ollamaModels,
    availableModels,
    isProcessing,
  } = useAppStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const allModels = [
    ...availableModels,
    ...ollamaModels
      .filter(m => !availableModels.some(am => am.id === m))
      .map(m => ({
        id: m,
        name: `${m} (Local)`,
        provider: 'ollama' as const,
        description: 'Local Ollama model',
        maxAudioLength: 300,
        supportsDiarization: false,
        supportsTimestamps: true,
      })),
  ];

  const currentModelInfo = allModels.find(m => m.id === selectedModel);

  return (
    <>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
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

            {/* Model Selector - Center */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isProcessing}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {allModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <Badge
                          variant={model.provider === 'gemini' ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {model.provider === 'gemini' ? 'Cloud' : 'Local'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentModelInfo && (
                <Badge variant="outline" className="text-xs">
                  {currentModelInfo.provider === 'gemini' ? '☁️' : '🖥️'} {currentModelInfo.provider === 'gemini' ? 'Cloud' : 'Local'}
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {currentView !== 'upload' && currentView !== 'history' && !isProcessing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { reset(); setCurrentView('upload'); }}
                  className="gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              )}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                disabled={isProcessing}
              >
                <Settings className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>

          {/* Mobile Model Selector */}
          <div className="sm:hidden pb-3">
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isProcessing}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {allModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      <Badge variant={model.provider === 'gemini' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {model.provider === 'gemini' ? 'Cloud' : 'Local'}
                      </Badge>
                    </div>
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
