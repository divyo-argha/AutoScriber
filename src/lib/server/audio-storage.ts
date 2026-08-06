import fs from 'fs';
import path from 'path';
import os from 'os';

// Directory for persistent audio storage
const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'data', 'audio');

export function ensureAudioStorageDir(): void {
  if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
    fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Sanitizes a client-supplied filename to prevent path traversal when it is
 * joined into local temp & persistent storage paths.
 */
export function sanitizeFileName(name: string): string {
  return path.basename(name).replace(/[^\w.\-() ]/g, '_');
}

/**
 * Saves an uploaded file to a fresh temp dir and returns the on-disk path.
 * Throws for empty files.
 */
export async function saveUploadedFile(file: File): Promise<{ filePath: string; tempDir: string }> {
  const safeFileName = sanitizeFileName(file.name);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoscriber-upload-'));
  const filePath = path.join(tempDir, safeFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const savedStats = fs.statSync(filePath);
  if (savedStats.size === 0) {
    try { fs.unlinkSync(filePath); } catch {}
    try { fs.rmdirSync(tempDir); } catch {}
    throw new Error('The uploaded file is empty after saving. The recording may have failed — please try recording again.');
  }

  console.log(`[transcribe] File saved: ${file.name}, size: ${savedStats.size} bytes`);
  return { filePath, tempDir };
}

/**
 * Mirrors an uploaded file into persistent storage so it can be replayed later
 * from the history view. Returns the persistent path (or null on failure).
 */
export async function savePersistentAudio(sourcePath: string, fileName: string): Promise<string | null> {
  ensureAudioStorageDir();
  const persistentAudioPath = path.join(AUDIO_STORAGE_DIR, `${Date.now()}_${sanitizeFileName(fileName)}`);
  try {
    fs.copyFileSync(sourcePath, persistentAudioPath);
    console.log(`[transcribe] Audio saved to persistent storage: ${persistentAudioPath}`);
    return persistentAudioPath;
  } catch (err) {
    console.error('[transcribe] Failed to save audio to persistent storage:', err);
    return null;
  }
}
