'use client';

import { useCallback, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileAudio, X, Play, AlertCircle, Mic, FolderOpen, Globe, Loader2 } from 'lucide-react';
import { AudioRecorder } from './audio-recorder';

const ACCEPTED_TYPES = [
  'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/webm', 'audio/aac', 'audio/wma',
  'audio/x-ms-wma',
];

const ACCEPTED_EXTENSIONS = '.mp3,.wav,.ogg,.flac,.m4a,.webm,.aac,.wma';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UploadArea() {
  const {
    uploadedFile,
    setUploadedFile,
    setCurrentView,
    selectedModel,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [preflightWarning, setPreflightWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm', 'aac', 'wma'];

    if (!ACCEPTED_TYPES.includes(file.type) && !validExtensions.includes(ext || '')) {
      return 'Unsupported audio format. Please upload MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, or WMA files.';
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Maximum size is 2GB.';
    }

    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploadedFile(file);
  }, [validateFile, setUploadedFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
      setActiveTab('upload');
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleRecordingComplete = useCallback((file: File, _blob: Blob) => {
    setError(null);
    setUploadedFile(file);
  }, [setUploadedFile]);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setError(null);
    setPreflightWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setUploadedFile]);

  const canStart = useCallback(() => {
    const modelInfo = useAppStore.getState().availableModels.find(m => m.id === selectedModel);
    if (!modelInfo) return false;
    return !!uploadedFile;
  }, [uploadedFile, selectedModel]);

  const getStartWarning = useCallback((): string | null => {
    const modelInfo = useAppStore.getState().availableModels.find(m => m.id === selectedModel);
    if (!modelInfo) return 'Please select a model';
    if (!uploadedFile) return 'Please upload or record an audio file';
    return null;
  }, [selectedModel, uploadedFile]);

  /**
   * Pre-flight check: Before starting transcription, test if the selected
   * model provider is reachable. For Gemini, this checks if the API is
   * accessible from the user's location.
   */
  const startTranscription = useCallback(async () => {
    setPreflightWarning(null);
    const modelInfo = useAppStore.getState().availableModels.find(m => m.id === selectedModel);

    if (modelInfo?.provider === 'gemini') {
      setPreflightChecking(true);
      try {
        const params = new URLSearchParams({ model: selectedModel });
        const res = await fetch(`/api/gemini-test?${params}`);
        const data = await res.json();

        setPreflightChecking(false);
        if (data.connected) {
          setCurrentView('processing');
        } else if (data.errorType === 'no_key') {
          setPreflightWarning('GEMINI_API_KEY is not set in the server environment. Please add it to .env.local and restart.');
        } else if (data.errorType === 'location_blocked') {
          setPreflightWarning('Gemini API is not available in your region. Switch to a local Ollama model.');
        } else if (data.errorType === 'auth_failed') {
          setPreflightWarning('Gemini API key is invalid. Please check GEMINI_API_KEY in .env.local.');
        } else {
          // Other errors — proceed anyway
          setCurrentView('processing');
        }
      } catch {
        setPreflightChecking(false);
        setCurrentView('processing');
      }
    } else {
      setCurrentView('processing');
    }
  }, [selectedModel, setCurrentView]);

  if (uploadedFile) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10">
          <div className="p-5 sm:p-8 text-center space-y-4">
            <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <FileAudio className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground break-all">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatFileSize(uploadedFile.size)}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={removeFile}
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </Button>
              <Button
                size="sm"
                onClick={startTranscription}
                disabled={!canStart() || preflightChecking}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {preflightChecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {preflightChecking ? 'Checking...' : 'Start Transcription'}
              </Button>
            </div>
          </div>
        </Card>

        {getStartWarning() && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{getStartWarning()}</span>
          </div>
        )}

        {preflightWarning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
            <Globe className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Connection Issue Detected</p>
              <p className="text-xs mt-1 opacity-80">{preflightWarning}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="upload" className="gap-1.5 text-xs sm:text-sm">
            <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="record" className="gap-1.5 text-xs sm:text-sm">
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Record Audio
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card
            className={`relative border-2 border-dashed transition-all duration-200 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="p-6 sm:p-12 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-muted">
                <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-medium text-foreground">
                  Drop your audio file here
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                MP3, WAV, OGG, FLAC, M4A, WEBM, AAC, WMA — up to 2GB
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Record Tab */}
        <TabsContent value="record">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => setActiveTab('upload')}
          />
        </TabsContent>
      </Tabs>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">1.5h</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Max Audio Length</p>
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
    </div>
  );
}
