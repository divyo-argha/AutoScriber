import { buildTxt, buildSrt, buildMarkdown, buildVtt } from './formatters';
import type { ExportFormat } from './formatters';
import type { TranscriptionSegment } from '@/lib/transcriber/types';

export type ClientExportFormat = Extract<ExportFormat, 'txt' | 'md' | 'srt' | 'vtt'>;

interface DownloadTextOptions {
  content: string;
  filename: string;
  mimeType?: string;
}

/** Triggers a browser download for a text payload. */
export function downloadTextFile({ content, filename, mimeType = 'text/plain' }: DownloadTextOptions): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildClientExport(
  segments: TranscriptionSegment[],
  format: ClientExportFormat
): { content: string; ext: string; mimeType: string } {
  switch (format) {
    case 'txt':
      return { content: buildTxt(segments), ext: 'txt', mimeType: 'text/plain' };
    case 'srt':
      return { content: buildSrt(segments), ext: 'srt', mimeType: 'application/x-subrip' };
    case 'vtt':
      return { content: buildVtt(segments), ext: 'vtt', mimeType: 'text/vtt' };
    case 'md':
      return { content: buildMarkdown(segments), ext: 'md', mimeType: 'text/markdown' };
  }
}

/** Downloads a transcript using a client-side only format (txt/md/srt/vtt). */
export function downloadTranscriptClient(
  segments: TranscriptionSegment[],
  format: ClientExportFormat,
  filenameBase: string
): void {
  const { content, ext, mimeType } = buildClientExport(segments, format);
  downloadTextFile({ content, filename: `${filenameBase}.${ext}`, mimeType });
}
