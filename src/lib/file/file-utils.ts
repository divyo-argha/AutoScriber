export const ACCEPTED_AUDIO_EXTENSIONS = '.mp3,.wav,.ogg,.flac,.m4a,.webm,.aac,.wma';
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma']);

const ACCEPTED_TYPES = [
  'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/webm', 'audio/aac', 'audio/wma',
  'audio/x-ms-wma',
];

export function getAudioExtension(filename: string): string | undefined {
  return filename.split('.').pop()?.toLowerCase();
}

export function isAudioExtension(ext: string | undefined): boolean {
  return ext ? AUDIO_EXTENSIONS.has(ext) : false;
}

export function isAudioFile(filename: string): boolean {
  return isAudioExtension(getAudioExtension(filename));
}

/**
 * Validates an uploaded file. Returns a human-readable error string when the
 * file is not acceptable, otherwise `null`.
 */
export function validateFile(file: File): string | null {
  const ext = getAudioExtension(file.name);
  if (!ACCEPTED_TYPES.includes(file.type) && !isAudioExtension(ext)) {
    return `${file.name}: unsupported format`;
  }
  if (file.size > MAX_FILE_SIZE) return `${file.name}: too large (max 2GB)`;
  return null;
}

/** Filters a list of files down to supported audio files. */
export function filterAudioFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter(f => isAudioFile(f.name));
}

export function formatFileSize(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}
