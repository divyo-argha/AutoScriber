'use client';

import { Cloud, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettingsForm } from './use-settings-form';
import { SettingsHeader } from './settings-header';
import { SettingsFooter } from './settings-footer';
import { VertexTab } from './vertex-tab';
import { GeminiTab } from './gemini-tab';
import { AdvancedTab } from './advanced-tab';
import styles from './settings-view.module.css';

export function SettingsView() {
  const form = useSettingsForm();

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <SettingsHeader mainSectionTab={form.mainSectionTab} onTabChange={form.setMainSectionTab} />

        <div className={styles.body}>
          <Tabs value={form.mainSectionTab} onValueChange={v => form.setMainSectionTab(v as 'config' | 'advanced')} className={styles.tabsWrap}>
            {/* MAIN TAB 1: AI ENGINE CONFIG */}
            <TabsContent value="config" className={`${styles.tabContent} ${styles.tabContentFlat}`}>
              <Tabs value={form.activeTab} onValueChange={v => form.setActiveTab(v as 'vertex' | 'gemini')} className={styles.providerTabsWrap}>
                <TabsList className={styles.providerTabsList}>
                  <TabsTrigger value="vertex" className={`${styles.providerTabBtn} ${styles.providerTabVertex}`}>
                    <span className={styles.tabTriggerTop}>
                      <Cloud className={styles.iconSm} /> Vertex AI (GCP)
                    </span>
                    <span className={styles.tabTriggerSub}>Service account credentials</span>
                  </TabsTrigger>
                  <TabsTrigger value="gemini" className={`${styles.providerTabBtn} ${styles.providerTabGemini}`}>
                    <span className={styles.tabTriggerTop}>
                      <Sparkles className={styles.iconSm} /> Google AI Studio
                    </span>
                    <span className={styles.tabTriggerSub}>Gemini API key</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="vertex" className={styles.tabContent}>
                  <VertexTab
                    gcpStatus={form.gcpStatus}
                    gcpLocation={form.gcpLocation}
                    onLocationChange={form.setGcpLocation}
                    gcpCredentialsJson={form.gcpCredentialsJson}
                    onCredentialsJsonChange={form.setGcpCredentialsJson}
                    jsonValidation={form.jsonValidation}
                    vertexStatus={form.vertexStatus}
                    vertexSuccess={form.vertexSuccess}
                    vertexError={form.vertexError}
                    onTest={form.testVertex}
                  />
                </TabsContent>

                <TabsContent value="gemini" className={styles.tabContent}>
                  <GeminiTab
                    localGeminiKey={form.localGeminiKey}
                    onKeyChange={form.setLocalGeminiKey}
                    showApiKey={form.showApiKey}
                    onToggleShowKey={() => form.setShowApiKey(!form.showApiKey)}
                    geminiStatus={form.geminiStatus}
                    geminiError={form.geminiError}
                    geminiSuccessModel={form.geminiSuccessModel}
                    onTest={form.testGemini}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* MAIN TAB 2: ADVANCED & MAINTENANCE */}
            <TabsContent value="advanced" className={styles.tabContent}>
              <AdvancedTab
                localChunkDuration={form.localChunkDuration}
                onChunkDurationChange={form.setLocalChunkDuration}
                localOverlapDuration={form.localOverlapDuration}
                onOverlapDurationChange={form.setLocalOverlapDuration}
                onReset={form.resetAdvanced}
                cleaningStorage={form.cleaningStorage}
                onCleanupStorage={form.handleCleanupStorage}
              />
            </TabsContent>
          </Tabs>
        </div>

        <SettingsFooter
          saving={form.saving}
          onCancel={() => form.setCurrentView('upload')}
          onSave={form.saveSettings}
        />
      </div>
    </div>
  );
}
