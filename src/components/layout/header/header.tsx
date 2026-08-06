'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Settings, Mic, RotateCcw, History, AlertTriangle } from 'lucide-react';
import { SettingsDialog } from '@/components/settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_MODELS } from '@/lib/transcriber/types';
import styles from './header.module.css';

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
    jobId,
    processingProgress,
  } = useAppStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  const hasGeminiKey = !!(userGeminiApiKey || geminiApiKey === '***');

  function isModelAvailable(model?: typeof ALL_MODELS[number]) {
    if (!model) return false;
    // Vertex models are authenticated via service account credentials (configured in Settings).
    if (model.provider !== 'gemini') return true;
    return hasGeminiKey;
  }

  const ModelOption = ({ model }: { model: typeof ALL_MODELS[number] }) => {
    const available = isModelAvailable(model);
    return (
      <div className={styles.modelOption}>
        <span className={available ? undefined : styles.modelOptionMuted}>{model.name}</span>
        {!available && (
          <span title="API key not set — configure in Settings" className={styles.warnIcon}>
            <AlertTriangle className={styles.warnIcon} />
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.bar}>
            <div
              className={styles.logo}
              onClick={() => {
                if (isProcessing) {
                  setCurrentView('processing');
                  return;
                }
                reset();
                setCurrentView('upload');
              }}
            >
              <div className={styles.logoIcon}>
                <Mic className={styles.iconLg} />
              </div>
              <div>
                <h1 className={styles.brand}>autoScriber</h1>
                <p className={styles.tagline}>Bangla Audio Transcription</p>
              </div>
            </div>

            <div className={styles.modelGroup}>
              <span className={styles.modelLabel}>Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className={styles.modelTrigger}>
                  <div className={styles.triggerContent}>
                    <span className={styles.truncate}>{ALL_MODELS.find(m => m.id === selectedModel)?.name ?? selectedModel}</span>
                    {!isModelAvailable(ALL_MODELS.find(m => m.id === selectedModel)) && (
                      <AlertTriangle className={styles.warnIcon} />
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {ALL_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <ModelOption model={model} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.actions}>
              {isProcessing && currentView !== 'processing' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentView('processing')}
                  className={styles.processingBtn}
                >
                  <span className={styles.pingDot} />
                  Processing ({processingProgress}%)
                </Button>
              )}
              {currentView !== 'upload' && currentView !== 'history' && !isProcessing && (
                <Button variant="outline" size="sm" onClick={() => { reset(); setCurrentView('upload'); }} className={styles.actionBtn}>
                  <RotateCcw className={styles.iconSm} />
                  <span className={styles.hiddenSmInline}>New</span>
                </Button>
              )}
              <Button
                variant={currentView === 'history' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView(currentView === 'history' ? 'upload' : 'history')}
                className={styles.actionBtn}
              >
                <History className={styles.iconMd} />
                <span className={styles.hiddenSmInline}>History</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                <Settings className={styles.iconLg} />
              </Button>
            </div>
          </div>

          {/* Mobile model selector */}
          <div className={styles.mobileSelectWrap}>
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isProcessing}>
              <SelectTrigger className={styles.modelTriggerFull}>
                <div className={styles.triggerContent}>
                  <span className={styles.truncate}>{ALL_MODELS.find(m => m.id === selectedModel)?.name ?? selectedModel}</span>
                  {!isModelAvailable(ALL_MODELS.find(m => m.id === selectedModel)) && (
                    <AlertTriangle className={styles.warnIcon} />
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                {ALL_MODELS.map(model => (
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
