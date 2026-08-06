'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Mic, History, Settings, AlertTriangle, Ban, Star } from 'lucide-react';
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
    disabledModels,
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

  const currentModelDisabledReason = disabledModels[selectedModel];

  const ModelOption = ({ model }: { model: typeof ALL_MODELS[number] }) => {
    const available = isModelAvailable(model);
    const disabledReason = disabledModels[model.id];
    const isUnselectable = !available || Boolean(disabledReason);

    return (
      <div className={`${styles.modelOption} ${isUnselectable ? styles.modelOptionDimmed : ''}`}>
        <div className={styles.modelNameWrap}>
          <span className={`${styles.modelName} ${isUnselectable ? styles.modelOptionMuted : ''}`}>{model.name}</span>
          {model.recommended && !disabledReason && (
            <span className={styles.recBadge}>
              <Star className={styles.recBadgeIcon} />
              Rec
            </span>
          )}
        </div>
        <div className={styles.modelNameWrap}>
          {disabledReason ? (
            <span title={disabledReason} className={styles.quotaBadge}>
              <Ban className={styles.quotaBadgeIcon} />
              Quota Limit
            </span>
          ) : (
            <span className={styles.providerTag}>
              {model.provider === 'vertex' ? 'Vertex' : 'Studio'}
            </span>
          )}
          {!available && !disabledReason && (
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
                    {currentModelDisabledReason ? (
                      <span title={currentModelDisabledReason} className={styles.rateLimitBadge}>
                        <Ban className={styles.quotaBadgeIcon} />
                        Rate-Limited
                      </span>
                    ) : !isModelAvailable(ALL_MODELS.find(m => m.id === selectedModel)) ? (
                      <AlertTriangle className={styles.warnIcon} />
                    ) : null}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {ALL_MODELS.map(model => {
                    const available = isModelAvailable(model);
                    const disabledReason = disabledModels[model.id];
                    const isDisabled = !available || Boolean(disabledReason);
                    return (
                      <SelectItem key={model.id} value={model.id} disabled={isDisabled}>
                        <ModelOption model={model} />
                      </SelectItem>
                    );
                  })}
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
                  {currentModelDisabledReason ? (
                    <span title={currentModelDisabledReason} className={styles.rateLimitBadge}>
                      <Ban className={styles.quotaBadgeIcon} />
                      Rate-Limited
                    </span>
                  ) : !isModelAvailable(ALL_MODELS.find(m => m.id === selectedModel)) ? (
                    <AlertTriangle className={styles.warnIcon} />
                  ) : null}
                </div>
              </SelectTrigger>
              <SelectContent>
                {ALL_MODELS.map(model => {
                  const available = isModelAvailable(model);
                  const disabledReason = disabledModels[model.id];
                  const isDisabled = !available || Boolean(disabledReason);
                  return (
                    <SelectItem key={model.id} value={model.id} disabled={isDisabled}>
                      <ModelOption model={model} />
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
    </>
  );
}
