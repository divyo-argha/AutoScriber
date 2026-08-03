import JSZip from 'jszip';

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma']);

export function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.has(ext) : false;
}

export async function extractAudioFilesFromZip(zipFile: File): Promise<File[]> {
  const zip = new JSZip();
  await zip.loadAsync(zipFile);

  const audioFiles: File[] = [];

  const processFolder = async (folder: JSZip, path: string = '') => {
    for (const [name, file] of Object.entries(folder.files)) {
      if (file.dir) {
        const subfolder = folder.folder(name);
        if (subfolder) {
          await processFolder(subfolder, path + name);
        }
      } else if (isAudioFile(name)) {
        const blob = await file.async('blob');
        const fullPath = path + name;
        audioFiles.push(new File([blob], fullPath, { type: blob.type }));
      }
    }
  };

  await processFolder(zip);
  return audioFiles;
}

export async function extractAudioFilesFromDirectory(entries: FileSystemEntry[]): Promise<File[]> {
  const audioFiles: File[] = [];

  const processEntry = async (entry: FileSystemEntry) => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      if (isAudioFile(file.name)) {
        audioFiles.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      for (const e of entries) {
        await processEntry(e);
      }
    }
  };

  for (const entry of entries) {
    await processEntry(entry);
  }

  return audioFiles;
}
