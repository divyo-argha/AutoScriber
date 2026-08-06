'use client';

import { ArrowRight, Key } from 'lucide-react';
import { ApiKeyInput } from './api-key-input';
import { ConnectionStatus } from './connection-status';
import { GeminiInsights } from './gemini-insights';
import type { TestStatus } from './use-settings-form';
import styles from './settings-view.module.css';

interface GeminiTabProps {
  localGeminiKey: string;
  onKeyChange: (value: string) => void;
  showApiKey: boolean;
  onToggleShowKey: () => void;
  geminiStatus: TestStatus;
  geminiError: string;
  geminiSuccessModel: string;
  onTest: () => void;
}

export function GeminiTab({
  localGeminiKey,
  onKeyChange,
  showApiKey,
  onToggleShowKey,
  geminiStatus,
  geminiError,
  geminiSuccessModel,
  onTest,
}: GeminiTabProps) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={`${styles.cardHeadIcon} ${styles.cardHeadIconBrand}`}>
            <Key className={styles.iconMd} />
          </div>
          <div>
            <p className={styles.cardTitle}>Gemini API Key</p>
            <p className={styles.cardDesc}>Generate a key at AI Studio, paste it below and verify.</p>
          </div>
        </div>

        <ApiKeyInput
          value={localGeminiKey}
          onChange={onKeyChange}
          showKey={showApiKey}
          onToggleShow={onToggleShowKey}
          status={geminiStatus}
          onTest={onTest}
        />

        {geminiStatus === 'connected' && (
          <ConnectionStatus variant="success" title="API Key verified & ready!">
            Working model: <code className={styles.credCode}>{geminiSuccessModel}</code>
          </ConnectionStatus>
        )}
        {geminiStatus === 'error' && (
          <ConnectionStatus variant="error" title="Connection Error">
            {geminiError}
          </ConnectionStatus>
        )}

        <p className={styles.geminiHint}>
          Get your key at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className={styles.geminiLink}>
            aistudio.google.com <ArrowRight className={styles.linkArrow} />
          </a>
        </p>
      </div>

      <GeminiInsights />
    </div>
  );
}
