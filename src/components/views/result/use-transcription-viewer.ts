import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { buildSpeakerColors, getUniqueSpeakers, buildSkippedRanges } from '@/lib/transcript';
import { downloadTranscriptClient } from '@/lib/transcript/download';
import type { ClientExportFormat } from '@/lib/transcript/download';
import type { ExportFormat } from './viewer-export-card';
import type { ViewMode } from './viewer-stats-bar';

/**
 * Viewer state & actions: copy-to-clipboard, client/server export, view mode,
 * and memoized derived values (speaker colors, skipped ranges, unique speakers).
 */
export function useTranscriptionViewer() {
  const {
    transcriptionSegments,
    transcriptionText,
    jobId,
    transcriptionSkippedChunks,
    chunkDuration,
    audioDuration,
    seekTo,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('player');

  const speakerColors = useMemo(
    () => buildSpeakerColors(transcriptionSegments),
    [transcriptionSegments]
  );

  const uniqueSpeakers = useMemo(
    () => getUniqueSpeakers(transcriptionSegments),
    [transcriptionSegments]
  );

  const skippedRanges = useMemo(
    () => buildSkippedRanges(transcriptionSkippedChunks, chunkDuration, audioDuration),
    [transcriptionSkippedChunks, chunkDuration, audioDuration]
  );

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [transcriptionText]);

  const handleSegmentClick = useCallback(
    (startTime: number) => seekTo(startTime),
    [seekTo]
  );

  const exportClientFile = useCallback((format: ClientExportFormat) => {
    downloadTranscriptClient(transcriptionSegments, format, 'transcription');
  }, [transcriptionSegments]);

  const exportServerFile = useCallback(async (format: 'docx' | 'pdf') => {
    setExportingFormat(format);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          segments: transcriptionSegments,
          fileName: 'transcription',
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcription.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportingFormat(null);
    }
  }, [transcriptionSegments]);

  const handleExport = useCallback((format: ExportFormat) => {
    if (format === 'docx' || format === 'pdf') {
      exportServerFile(format);
    } else {
      exportClientFile(format);
    }
  }, [exportServerFile, exportClientFile]);

  return {
    copied,
    exportingFormat,
    viewMode,
    setViewMode,
    speakerColors,
    uniqueSpeakers,
    skippedRanges,
    copyToClipboard,
    handleSegmentClick,
    handleExport,
  };
}
