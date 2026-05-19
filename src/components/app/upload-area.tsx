'use client';

import { useCallback, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { BatchJob } from '@/lib/store';
import { extractAudioFilesFromZip, extractAudioFilesFromDirectory } from '@/lib/file-utils';
import { signInWithGoogle, listDriveAudioFiles, downloadDriveFile } from '@/lib/google-drive';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileAudio, X, Play, AlertCircle, Mic, FolderOpen, Globe, Loader2, Files, Archive, Cloud } from 'lucide-react';
import { AudioRecorder } from './audio-recorder';
import { OllamaInstallModal } from './ollama-install-modal';

const ACCEPTED_EXTENSIONS = '.mp3,.wav,.ogg,.flac,.m4a,.webm,.aac,.wma';
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (!bytes || !isFinite(bytes)) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const validExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma'];
  if (!ACCEPTED_TYPES.includes(file.type) && !validExts.includes(ext || '')) {
    return `${file.name}: unsupported format`;
  }
  if (file.size > MAX_FILE_SIZE) return `${file.name}: too large (max 2GB)`;
  return null;
}

const ACCEPTED_TYPES = [
  'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/webm', 'audio/aac', 'audio/wma',
  'audio/x-ms-wma',
];

export function UploadArea() {
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
  const [ollamaInstallOpen, setOllamaInstallOpen] = useState(false);
  const [ollamaModelToInstall, setOllamaModelToInstall] = useState<string | null>(null);
  const [pendingBatchAfterInstall, setPendingBatchAfterInstall] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length) setError(errors.join('; '));
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
  }, [pendingFiles.length, setUploadedFile]);

  const handleZipUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const audioFiles = await extractAudioFilesFromZip(file);
      if (audioFiles.length === 0) {
        setError('No audio files found in ZIP');
        return;
      }
      addFiles(audioFiles);
      setActiveTab('upload');
    } catch (err) {
      setError(`Failed to extract ZIP: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    e.target.value = '';
  }, [addFiles]);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const items = e.currentTarget.webkitdirectory ? e.target.files : null;
    if (!items) return;

    setError(null);
    try {
      const audioFiles = Array.from(items).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ext && ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma'].includes(ext);
      });
      if (audioFiles.length === 0) {
        setError('No audio files found in folder');
        return;
      }
      addFiles(audioFiles);
      setActiveTab('upload');
    } catch (err) {
      setError(`Failed to read folder: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    e.target.value = '';
  }, [addFiles]);

  const handleGoogleDriveConnect = useCallback(async () => {
    setDriveLoading(true);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        setError('Failed to sign in with Google');
        setDriveLoading(false);
        return;
      }
      const files = await listDriveAudioFiles();
      setDriveFiles(files);
    } catch (err) {
      setError(`Google Drive error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const handleDriveDownload = useCallback(async () => {
    if (driveSelected.size === 0) {
      setError('Select at least one file');
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
        setError('Failed to download files');
        return;
      }
      addFiles(downloaded);
      setDriveFiles([]);
      setDriveSelected(new Set());
      setActiveTab('upload');
    } catch (err) {
      setError(`Download error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDriveLoading(false);
    }
  }, [driveSelected, driveFiles, addFiles]);

  const startPreflight = useCallback(async (onPass: () => void) => {
    setPreflightWarning(null);
    const modelInfo = useAppStore.getState().availableModels.find(m => m.id === selectedModel);
    const state = useAppStore.getState();

    if (modelInfo?.provider === 'gemini') {
      setPreflightChecking(true);
      try {
        const res = await fetch(`/api/gemini-test?model=${selectedModel}`);
        const data = await res.json();
        setPreflightChecking(false);
        if (data.connected) {
          onPass();
        } else if (data.errorType === 'no_key') {
          setPreflightWarning('GEMINI_API_KEY is not set. Add it to .env.local and restart.');
        } else if (data.errorType === 'location_blocked') {
          setPreflightWarning('Gemini API is not available in your region. Switch to a local Ollama model.');
        } else if (data.errorType === 'auth_failed') {
          setPreflightWarning('Gemini API key is invalid. Check GEMINI_API_KEY in .env.local.');
        } else {
          onPass();
        }
      } catch {
        setPreflightChecking(false);
        onPass();
      }
    } else if (modelInfo?.provider === 'ollama') {
      setPreflightChecking(true);
      try {
        const res = await fetch(`/api/ollama-status?ollamaUrl=${encodeURIComponent(state.ollamaUrl)}`);
        const data = await res.json();
        setPreflightChecking(false);
        if (data.connected && data.models.includes(selectedModel)) {
          onPass();
        } else if (!data.connected) {
          setPreflightWarning(`Ollama is not running at ${state.ollamaUrl}. Start Ollama or change the URL in Settings → Local.`);
        } else {
          setOllamaModelToInstall(selectedModel);
          setPendingBatchAfterInstall(true);
          setOllamaInstallOpen(true);
        }
      } catch {
        setPreflightChecking(false);
        setPreflightWarning(`Cannot connect to Ollama at ${state.ollamaUrl}. Make sure it's running.`);
      }
    } else {
      onPass();
    }
  }, [selectedModel]);

  if (uploadedFile && pendingFiles.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10">
          <div className="p-5 sm:p-8 text-center space-y-4">
            <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <FileAudio className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium break-all">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatFileSize(uploadedFile.size)}</p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { setUploadedFile(null); setPreflightWarning(null); }} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Remove
              </Button>
              <Button
                size="sm"
                onClick={() => startPreflight(() => setCurrentView('processing'))}
                disabled={preflightChecking}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {preflightChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {preflightChecking ? 'Checking...' : 'Start Transcription'}
              </Button>
            </div>
          </div>
        </Card>
        {preflightWarning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
            <Globe className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{preflightWarning}</p>
          </div>
        )}
      </div>
    );
  }

  if (pendingFiles.length > 0) {
    const startBatch = () => startPreflight(() => {
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
      }));
      setBatchJobs(jobs);
      setCurrentView('batch');
    });

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-2">
                <Files className="w-4 h-4 text-emerald-600" />
                {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setPendingFiles([]); setError(null); }} className="text-xs gap-1">
                <X className="w-3 h-3" /> Clear all
              </Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                  <FileAudio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="flex-1 truncate text-xs">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(f.size)}</span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-xs">
                <FolderOpen className="w-3.5 h-3.5" /> Add more
              </Button>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} className="hidden" />
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={startBatch}
                disabled={preflightChecking}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {preflightChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {preflightChecking ? 'Checking...' : `Transcribe ${pendingFiles.length} files`}
              </Button>
            </div>
          </div>
        </Card>
        {preflightWarning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
            <Globe className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{preflightWarning}</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="upload" className="gap-1 text-[10px] sm:text-xs">
            <FolderOpen className="w-3 h-3" /> <span className="hidden sm:inline">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="zip" className="gap-1 text-[10px] sm:text-xs">
            <Archive className="w-3 h-3" /> <span className="hidden sm:inline">ZIP</span>
          </TabsTrigger>
          <TabsTrigger value="folder" className="gap-1 text-[10px] sm:text-xs">
            <Files className="w-3 h-3" /> <span className="hidden sm:inline">Folder</span>
          </TabsTrigger>
          <TabsTrigger value="drive" className="gap-1 text-[10px] sm:text-xs">
            <Cloud className="w-3 h-3" /> <span className="hidden sm:inline">Drive</span>
          </TabsTrigger>
          <TabsTrigger value="record" className="gap-1 text-[10px] sm:text-xs">
            <Mic className="w-3 h-3" /> <span className="hidden sm:inline">Record</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card className="border-2 border-dashed transition-all duration-200 border-muted-foreground/25 hover:border-muted-foreground/40"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) { addFiles(e.dataTransfer.files); setActiveTab('upload'); } }}
          >
            <div className="p-6 sm:p-12 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-muted">
                <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-medium">Drop audio files here</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Single or multiple files supported</p>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <FolderOpen className="w-4 h-4" /> Choose Files
              </Button>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} className="hidden" />
              <p className="text-xs text-muted-foreground">MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, WMA — up to 2GB each</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="zip">
          <Card className="border-2 border-dashed">
            <div className="p-6 sm:p-12 text-center space-y-4">
              <Archive className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm sm:text-base font-medium">Upload ZIP file</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Extracts audio files recursively</p>
              </div>
              <Button variant="outline" onClick={() => zipInputRef.current?.click()} className="gap-2">
                <Archive className="w-4 h-4" /> Choose ZIP
              </Button>
              <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="folder">
          <Card className="border-2 border-dashed">
            <div className="p-6 sm:p-12 text-center space-y-4">
              <Files className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm sm:text-base font-medium">Select folder</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Scans recursively for audio files</p>
              </div>
              <Button variant="outline" onClick={() => folderInputRef.current?.click()} className="gap-2">
                <FolderOpen className="w-4 h-4" /> Choose Folder
              </Button>
              <input ref={folderInputRef} type="file" webkitdirectory="" onChange={handleFolderUpload} className="hidden" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="drive">
          <Card className="border-2 border-dashed">
            <div className="p-6 sm:p-12 text-center space-y-4">
              <Cloud className="w-12 h-12 mx-auto text-muted-foreground" />
              {driveFiles.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm sm:text-base font-medium">Google Drive</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Connect and select audio files</p>
                  </div>
                  <Button onClick={handleGoogleDriveConnect} disabled={driveLoading} className="gap-2">
                    {driveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                    {driveLoading ? 'Connecting...' : 'Connect Google Drive'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {driveFiles.map(f => (
                      <label key={f.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <input type="checkbox" checked={driveSelected.has(f.id)} onChange={(e) => {
                          const s = new Set(driveSelected);
                          if (e.target.checked) s.add(f.id);
                          else s.delete(f.id);
                          setDriveSelected(s);
                        }} className="w-4 h-4" />
                        <FileAudio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="flex-1 truncate text-xs">{f.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setDriveFiles([]); setDriveSelected(new Set()); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleDriveDownload} disabled={driveLoading || driveSelected.size === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                      {driveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Download ({driveSelected.size})
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="record">
          <AudioRecorder onRecordingComplete={(file) => { setError(null); setUploadedFile(file); }} onCancel={() => setActiveTab('upload')} />
        </TabsContent>
      </Tabs>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">∞</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Batch Files</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">BN+EN</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Bangla-English Mixed</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">5+</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Export Formats</p>
        </Card>
      </div>

      <OllamaInstallModal
        open={ollamaInstallOpen}
        modelId={ollamaModelToInstall || ''}
        onClose={() => {
          setOllamaInstallOpen(false);
          setOllamaModelToInstall(null);
          setPendingBatchAfterInstall(false);
        }}
        onComplete={() => {
          setOllamaInstallOpen(false);
          setOllamaModelToInstall(null);
          if (pendingBatchAfterInstall) {
            setPendingBatchAfterInstall(false);
            startPreflight(() => setCurrentView('processing'));
          }
        }}
      />
    </div>
  );
}
