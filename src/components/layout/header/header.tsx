'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Mic, RotateCcw, History, Settings, AlertTriangle } from 'lucide-react';
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
    processingProgress,
  } = useAppStore();

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
      <div className={styles.modelOption} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span className={available ? undefined : styles.modelOptionMuted} style={{ fontWeight: 600 }}>{model.name}</span>
          {model.recommended && (
            <span style={{ fontSize: '9px', padding: '0.1rem 0.35rem', borderRadius: '9999px', backgroundColor: 'color-mix(in oklab, var(--brand-500) 20%, transparent)', color: 'var(--brand-300)', fontWeight: 700 }}>
              ★ Rec
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6, fontWeight: 600 }}>
            {model.provider === 'vertex' ? 'Vertex' : 'Studio'}
          </span>
          {!available && (
            <span title="Credentials not set — configure in Settings" className={styles.warnIcon}>
              <AlertTriangle className={styles.warnIcon} />
            </span>
          )}
        </div>
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
              <Button
                variant={currentView === 'upload' || currentView === 'processing' || currentView === 'result' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  if (isProcessing) setCurrentView('processing');
                  else setCurrentView('upload');
                }}
                className={styles.actionBtn}
              >
                <Mic className={styles.iconSm} />
                <span className={styles.hiddenSmInline}>Studio</span>
              </Button>
              <Button
                variant={currentView === 'history' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('history')}
                className={styles.actionBtn}
              >
                <History className={styles.iconSm} />
                <span className={styles.hiddenSmInline}>History</span>
              </Button>
              <Button
                variant={currentView === 'settings' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('settings')}
                className={styles.actionBtn}
              >
                <Settings className={styles.iconSm} />
                <span className={styles.hiddenSmInline}>Settings</span>
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
    </>
  );
}
