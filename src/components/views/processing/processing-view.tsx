'use client';

import { Card } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { useTranscriptionJob } from './use-transcription-job';
import { ProcessingIcon } from './processing-icon';
import { ProcessingStatusText } from './processing-status-text';
import { ProcessingProgressBar } from './processing-progress';
import { ProcessingControls } from './processing-controls';
import { ProcessingInfoGrid } from './processing-info-grid';
import { LiveResults } from './live-results';
import { ProcessingSteps } from './processing-steps';
import { CancelledPanel } from './cancelled-panel';
import { ErrorPanel } from './error-panel';
import { ConfirmDialogs } from './confirm-dialogs';
import { downloadPartialTranscript } from './download-partial';
import styles from './processing-view.module.css';

export function ProcessingView() {
  const { chunkDuration } = useAppStore();
  const job = useTranscriptionJob();

  const modelName = job.modelInfo?.name || job.selectedModel;
  const modelProvider = job.modelInfo?.provider || '';

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <div className={styles.inner}>
          <ProcessingIcon
            isProcessing={job.isProcessing}
            processingProgress={job.processingProgress}
            isCancelled={job.isCancelled}
            isFailed={job.isFailed}
          />

          <ProcessingStatusText
            isProcessing={job.isProcessing}
            processingProgress={job.processingProgress}
            isCancelled={job.isCancelled}
            isFailed={job.isFailed}
            processingStatus={job.processingStatus}
            estimatedTime={job.estimatedTime}
          />

          <ProcessingProgressBar
            processingProgress={job.processingProgress}
            chunksTotal={job.chunksTotal}
            chunksDone={job.chunksDone}
            processingStatus={job.processingStatus}
          />

          <ProcessingControls
            isProcessing={job.isProcessing}
            paused={job.paused}
            cancelling={job.cancelling}
            onPauseResume={() => {
              if (job.paused) {
                job.sendControl('resume');
              } else {
                job.setConfirmPauseOpen(true);
              }
            }}
            onRequestCancel={() => job.setConfirmCancelOpen(true)}
          />

          {job.paused && (
            <div className={styles.pausedModelSelector}>
              <p className={styles.pausedModelLabel}>Choose a different model to resume with:</p>
              <select
                className={styles.modelSelect}
                value={job.selectedModel}
                onChange={(e) => {
                  job.updateJobModel(e.target.value);
                }}
              >
                {useAppStore.getState().availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className={styles.settingsLinkRow}>
                <button
                  type="button"
                  className={styles.settingsLinkBtn}
                  onClick={job.resetAndOpenSettings}
                >
                  Need to update your API Key? Go to Settings
                </button>
              </div>
            </div>
          )}

          <ProcessingInfoGrid
            uploadedFileName={job.uploadedFileName}
            modelName={modelName}
            modelProvider={modelProvider}
            selectedModel={job.selectedModel}
          />

          <LiveResults
            liveChunkResults={job.liveChunkResults}
            chunkDuration={chunkDuration}
          />

          <ProcessingSteps
            isProcessing={job.isProcessing}
            processingProgress={job.processingProgress}
            chunksTotal={job.chunksTotal}
          />

          {job.isCancelled && (
            <CancelledPanel 
              chunksDone={job.chunksDone} 
              chunksTotal={job.chunksTotal} 
              onDownloadPartial={() => downloadPartialTranscript(job.liveChunkResults, 'cancelled')}
              canDownload={job.liveChunkResults && job.liveChunkResults.length > 0}
            />
          )}

          {job.isFailed && (
            <ErrorPanel
              isLocationError={job.isLocationError}
              isAuthError={job.isAuthError}
              processingStatus={job.processingStatus}
              onGoBack={job.resetAndGoBack}
              onOpenSettings={job.resetAndOpenSettings}
              onRetry={job.resetAndRetry}
              onResume={(newModel) => job.updateJobModel(newModel || job.selectedModel)}
              selectedModel={job.selectedModel}
              onDownloadPartial={() => downloadPartialTranscript(job.liveChunkResults, 'failed')}
              canDownload={job.liveChunkResults && job.liveChunkResults.length > 0}
            />
          )}
        </div>
      </Card>

      <ConfirmDialogs
        uploadedFileName={job.uploadedFileName}
        confirmCancelOpen={job.confirmCancelOpen}
        confirmPauseOpen={job.confirmPauseOpen}
        onCancelOpenChange={job.setConfirmCancelOpen}
        onPauseOpenChange={job.setConfirmPauseOpen}
        onConfirmCancel={() => job.sendControl('cancel')}
        onConfirmPause={() => job.sendControl('pause')}
      />
    </div>
  );
}
