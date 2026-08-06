import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { BatchJob } from '@/lib/store';
import { extractAudioFilesFromZip } from '@/lib/file';
import { validateFile, filterAudioFiles } from '@/lib/file';
import { testGeminiConnection } from '@/lib/api';
import { signInWithGoogle, listDriveAudioFiles, downloadDriveFile } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';

/**
 * Owns all upload-source state and actions: file validation, ZIP/folder/Drive
 * ingestion, batch queueing, and the preflight Gemini connectivity check.
 */
export function useUploadArea() {
  const router = useRouter();
  const { uploadedFile, setUploadedFile, setCurrentView, selectedModel, setBatchJobs, clearBatch } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [preflightWarning, setPreflightWarning] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveSelected, setDriveSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const showError = useCallback((msg: string) => {
    setError(msg);
    toast({
      variant: 'destructive',
      title: 'File Upload/Processing Error',
      description: msg,
    });
  }, [toast]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length) showError(errors.join('; '));
    else setError(null);

    if (valid.length === 1 && pendingFiles.length === 0) {
      setUploadedFile(valid[0]);
    } else if (valid.length > 0) {
      setPendingFiles(prev => {
        const names = new Set(prev.map(f => f.name));
        return [...prev, ...valid.filter(f => !names.has(f.name))];
      });
      setUploadedFile(null);
    }
  }, [pendingFiles.length, setUploadedFile, showError]);

  const handleZipUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const audioFiles = await extractAudioFilesFromZip(file);
      if (audioFiles.length === 0) {
        showError('No audio files found in ZIP');
        return;
      }
      addFiles(audioFiles);
      setActiveTab('upload');
    } catch (err) {
      showError(`Failed to extract ZIP: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    e.target.value = '';
  }, [addFiles, showError]);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const items = e.currentTarget.webkitdirectory ? e.target.files : null;
    if (!items) return;

    setError(null);
    try {
      const audioFiles = filterAudioFiles(Array.from(items));
      if (audioFiles.length === 0) {
        showError('No audio files found in folder');
        return;
      }
      addFiles(audioFiles);
      setActiveTab('upload');
    } catch (err) {
      showError(`Failed to read folder: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    e.target.value = '';
  }, [addFiles, showError]);

  const handleGoogleDriveConnect = useCallback(async () => {
    setDriveLoading(true);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        showError('Failed to sign in with Google');
        return;
      }
      const files = await listDriveAudioFiles();
      setDriveFiles(files);
    } catch (err) {
      showError(`Google Drive error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDriveLoading(false);
    }
  }, [showError]);

  const handleDriveDownload = useCallback(async () => {
    if (driveSelected.size === 0) {
      showError('Select at least one file');
      return;
    }

    setDriveLoading(true);
    try {
      const downloaded: File[] = [];
      for (const fileId of driveSelected) {
        const file = driveFiles.find(f => f.id === fileId);
        if (file) {
          const f = await downloadDriveFile(fileId, file.name);
          if (f) downloaded.push(f);
        }
      }
      if (downloaded.length === 0) {
        showError('Failed to download files');
        return;
      }
      addFiles(downloaded);
      setDriveFiles([]);
      setDriveSelected(new Set());
      setActiveTab('upload');
    } catch (err) {
      showError(`Download error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDriveLoading(false);
    }
  }, [driveSelected, driveFiles, addFiles, showError]);

  const startPreflight = useCallback(async (onPass: () => void) => {
    setPreflightWarning(null);
    const state = useAppStore.getState();
    const modelInfo = state.availableModels.find(m => m.id === selectedModel);

    if (modelInfo?.provider === 'gemini') {
      setPreflightChecking(true);
      try {
        const data = await testGeminiConnection(selectedModel, state.userGeminiApiKey || undefined);
        if (data.connected) { onPass(); }
        else if (data.errorType === 'no_key') { setPreflightWarning('Gemini API key is not configured. Enter it in Settings.'); }
        else if (data.errorType === 'location_blocked') { setPreflightWarning('Gemini API is not available in your region.'); }
        else if (data.errorType === 'auth_failed') { setPreflightWarning('Gemini API key is invalid. Check your key in Settings.'); }
        else { onPass(); }
      } catch {
        onPass();
      } finally {
        setPreflightChecking(false);
      }
    } else {
      onPass();
    }
  }, [selectedModel]);

  const startBatch = useCallback(() => {
    startPreflight(() => {
      clearBatch();
      const jobs: BatchJob[] = pendingFiles.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        status: 'queued',
        progress: 0,
        segments: [],
        fullText: '',
        jobId: null,
        error: null,
        skippedChunks: [],
      }));
      setBatchJobs(jobs);
      router.push('/batch');
    });
  }, [pendingFiles, startPreflight, clearBatch, setBatchJobs, router]);

  const removeFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, j) => j !== index));
  }, []);

  const removeUploadedFile = useCallback(() => {
    setUploadedFile(null);
    setPreflightWarning(null);
  }, [setUploadedFile]);

  const clearPending = useCallback(() => {
    setPendingFiles([]);
    setError(null);
  }, []);

  return {
    uploadedFile,
    setUploadedFile,
    setCurrentView,
    selectedModel,
    isDragging,
    setIsDragging,
    error,
    setError,
    activeTab,
    setActiveTab,
    preflightChecking,
    preflightWarning,
    pendingFiles,
    driveLoading,
    driveFiles,
    driveSelected,
    setDriveSelected,
    fileInputRef,
    zipInputRef,
    folderInputRef,
    addFiles,
    handleZipUpload,
    handleFolderUpload,
    handleGoogleDriveConnect,
    handleDriveDownload,
    handleDriveCancel: () => {
      setDriveFiles([]);
      setDriveSelected(new Set());
    },
    startPreflight,
    startBatch,
    removeFile,
    removeUploadedFile,
    clearPending,
  };
}
