'use client';

import { useCallback, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { BatchJob } from '@/lib/store';
import { extractAudioFilesFromZip } from '@/lib/file-utils';
import { signInWithGoogle, listDriveAudioFiles, downloadDriveFile } from '@/lib/google-drive';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileAudio, X, Play, AlertCircle, Mic, FolderOpen, Globe, Loader2, Files, Archive, Cloud, Download } from 'lucide-react';
import { AudioRecorder } from './audio-recorder';
import { useToast } from '@/hooks/use-toast';
import styles from './upload-area.module.css';

const ACCEPTED_EXTENSIONS = '.mp3,.wav,.ogg,.flac,.m4a,.webm,.aac,.wma';
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const ACCEPTED_TYPES = [
  'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/webm', 'audio/aac', 'audio/wma',
  'audio/x-ms-wma',
];

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

export function UploadArea() {
  const { uploadedFile, setUploadedFile, setCurrentView, selectedModel, setBatchJobs, clearBatch, availableModels } = useAppStore();

  const selectedModelInfo = availableModels.find(m => m.id === selectedModel);

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
      const audioFiles = Array.from(items).filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ext && ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma'].includes(ext);
      });
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
        setDriveLoading(false);
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
    const modelInfo = useAppStore.getState().availableModels.find(m => m.id === selectedModel);
    const state = useAppStore.getState();

    if (modelInfo?.provider === 'gemini') {
      setPreflightChecking(true);
      try {
        const params = new URLSearchParams({ model: selectedModel });
        if (state.userGeminiApiKey) params.set('apiKey', state.userGeminiApiKey);
        const res = await fetch(`/api/gemini-test?${params.toString()}`);
        const data = await res.json();
        setPreflightChecking(false);
        if (data.connected) { onPass(); }
        else if (data.errorType === 'no_key') { setPreflightWarning('Gemini API key is not configured. Enter it in Settings.'); }
        else if (data.errorType === 'location_blocked') { setPreflightWarning('Gemini API is not available in your region.'); }
        else if (data.errorType === 'auth_failed') { setPreflightWarning('Gemini API key is invalid. Check your key in Settings.'); }
        else { onPass(); }
      } catch { setPreflightChecking(false); onPass(); }
    } else {
      onPass();
    }
  }, [selectedModel]);

  if (uploadedFile && pendingFiles.length === 0) {
    return (
      <div className={styles.wrapper}>
        <Card className={styles.uploadCard}>
          <div className={styles.uploadCardInner}>
            <div className={styles.fileIconWrap}>
              <FileAudio className={styles.fileIcon} />
            </div>
            <div>
              <p className={styles.fileName}>{uploadedFile.name}</p>
              <p className={styles.fileMeta}>{formatFileSize(uploadedFile.size)}</p>
            </div>
            <div className={styles.ctaRow}>
              <Button variant="outline" size="sm" onClick={() => { setUploadedFile(null); setPreflightWarning(null); }} className={styles.btnGap}>
                <X className={styles.iconSm} /> Remove
              </Button>
              <Button
                size="sm"
                onClick={() => startPreflight(() => setCurrentView('processing'))}
                disabled={preflightChecking}
                className={styles.primaryBtn}
              >
                {preflightChecking ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Play className={styles.iconSm} />}
                {preflightChecking ? 'Checking...' : 'Start Transcription'}
              </Button>
            </div>
          </div>
        </Card>
        {preflightWarning && (
          <div className={styles.warningBox}>
            <Globe className={styles.warningIcon} />
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
        skippedChunks: [],
      }));
      setBatchJobs(jobs);
      setCurrentView('batch');
    });

    return (
      <div className={styles.wrapper}>
        <Card>
          <div className={styles.pendingInner}>
            <div className={styles.pendingHeader}>
              <p className={styles.pendingTitle}>
                <Files className={styles.pendingTitleIcon} />
                {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} selected
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setPendingFiles([]); setError(null); }} className={styles.clearBtn}>
                <X className={styles.iconXs} /> Clear all
              </Button>
            </div>
            <div className={styles.fileList}>
              {pendingFiles.map((f, i) => (
                <div key={i} className={styles.fileRow}>
                  <FileAudio className={styles.fileRowIcon} />
                  <span className={styles.fileRowName}>{f.name}</span>
                  <span className={styles.fileRowSize}>{formatFileSize(f.size)}</span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className={styles.fileRowRemove}>
                    <X className={styles.iconXs} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.fileFooter}>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className={styles.btnSmall}>
                <FolderOpen className={styles.iconSm} /> Add more
              </Button>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} className={styles.hiddenInput} />
              <div className={styles.spacer} />
              <Button
                size="sm"
                onClick={startBatch}
                disabled={preflightChecking}
                className={styles.primaryBtn}
              >
                {preflightChecking ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Play className={styles.iconSm} />}
                {preflightChecking ? 'Checking...' : `Transcribe ${pendingFiles.length} files`}
              </Button>
            </div>
          </div>
        </Card>
        {preflightWarning && (
          <div className={styles.warningBox}>
            <Globe className={styles.warningIcon} />
            <p>{preflightWarning}</p>
          </div>
        )}
        {error && (
          <div className={styles.errorBox}>
            <AlertCircle className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.tabWrap}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="upload" className={styles.tabTrigger}>
            <FolderOpen className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Upload</span>
          </TabsTrigger>
          <TabsTrigger value="zip" className={styles.tabTrigger}>
            <Archive className={styles.iconXs} /> <span className={styles.hiddenSmInline}>ZIP</span>
          </TabsTrigger>
          <TabsTrigger value="folder" className={styles.tabTrigger}>
            <Files className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Folder</span>
          </TabsTrigger>
          <TabsTrigger value="drive" className={styles.tabTrigger}>
            <Cloud className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Drive</span>
          </TabsTrigger>
          <TabsTrigger value="record" className={styles.tabTrigger}>
            <Mic className={styles.iconXs} /> <span className={styles.hiddenSmInline}>Record</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card className={styles.dropZone}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) { addFiles(e.dataTransfer.files); setActiveTab('upload'); } }}
          >
            <div className={styles.dropInner}>
              <div className={styles.dropIconWrap}>
                <Upload className={styles.dropIcon} />
              </div>
              <div>
                <p className={styles.dropTitle}>Drop audio files here</p>
                <p className={styles.dropSubtitle}>Single or multiple files supported</p>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className={styles.gap2}>
                <FolderOpen className={styles.iconMd} /> Choose Files
              </Button>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} className={styles.hiddenInput} />
              <p className={styles.hint}>MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, WMA — up to 2GB each</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="zip">
          <Card className={styles.dropZone}>
            <div className={styles.dropInner}>
              <Archive className={styles.bigIcon} />
              <div>
                <p className={styles.dropTitle}>Upload ZIP file</p>
                <p className={styles.dropSubtitle}>Extracts audio files recursively</p>
              </div>
              <Button variant="outline" onClick={() => zipInputRef.current?.click()} className={styles.gap2}>
                <Archive className={styles.iconMd} /> Choose ZIP
              </Button>
              <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipUpload} className={styles.hiddenInput} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="folder">
          <Card className={styles.dropZone}>
            <div className={styles.dropInner}>
              <Files className={styles.bigIcon} />
              <div>
                <p className={styles.dropTitle}>Select folder</p>
                <p className={styles.dropSubtitle}>Scans recursively for audio files</p>
              </div>
              <Button variant="outline" onClick={() => folderInputRef.current?.click()} className={styles.gap2}>
                <FolderOpen className={styles.iconMd} /> Choose Folder
              </Button>
              {/* @ts-ignore: webkitdirectory is a browser-only folder selection attribute */}
              <input ref={folderInputRef} type="file" webkitdirectory="" onChange={handleFolderUpload} className={styles.hiddenInput} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="drive">
          <Card className={styles.dropZone}>
            <div className={styles.dropInner}>
              <Cloud className={styles.bigIcon} />
              {driveFiles.length === 0 ? (
                <>
                  <div>
                    <p className={styles.dropTitle}>Google Drive</p>
                    <p className={styles.dropSubtitle}>Connect and select audio files</p>
                  </div>
                  <Button onClick={handleGoogleDriveConnect} disabled={driveLoading} className={styles.gap2}>
                    {driveLoading ? <Loader2 className={`${styles.iconMd} ${styles.spinner}`} /> : <Cloud className={styles.iconMd} />}
                    {driveLoading ? 'Connecting...' : 'Connect Google Drive'}
                  </Button>
                </>
              ) : (
                <>
                  <div className={styles.driveList}>
                    {driveFiles.map(f => (
                      <label key={f.id} className={styles.driveRow}>
                        <input type="checkbox" checked={driveSelected.has(f.id)} onChange={(e) => {
                          const s = new Set(driveSelected);
                          if (e.target.checked) s.add(f.id);
                          else s.delete(f.id);
                          setDriveSelected(s);
                        }} className={styles.checkbox} />
                        <FileAudio className={styles.fileRowIcon} />
                        <span className={styles.fileRowName}>{f.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className={styles.driveActions}>
                    <Button variant="outline" size="sm" onClick={() => { setDriveFiles([]); setDriveSelected(new Set()); }} className={styles.driveBtn}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleDriveDownload} disabled={driveLoading || driveSelected.size === 0} className={styles.downloadBtn}>
                      {driveLoading ? <Loader2 className={`${styles.iconSm} ${styles.spinner}`} /> : <Download className={styles.iconSm} />}
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
        <div className={styles.errorBox}>
          <AlertCircle className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <p className={styles.statValue}>∞</p>
          <p className={styles.statLabel}>Batch Files</p>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statValue}>BN+EN</p>
          <p className={styles.statLabel}>Bangla-English Mixed</p>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statValue}>5+</p>
          <p className={styles.statLabel}>Export Formats</p>
        </Card>
      </div>
    </div>
  );
}