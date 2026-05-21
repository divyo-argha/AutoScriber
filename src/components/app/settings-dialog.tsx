'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Key, Server, Cpu, CheckCircle2, XCircle, Loader2, Globe, AlertTriangle, Wifi } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GeminiTestStatus = 'idle' | 'testing' | 'connected' | 'location_blocked' | 'auth_failed' | 'quota_exceeded' | 'error';

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    geminiApiKey,
    ollamaUrl,
    chunkDuration,
    overlapDuration,
    userGeminiApiKey,
    setSettings,
    setOllamaModels,
    selectedModel,
    setSelectedModel,
  } = useAppStore();

  const [localUserApiKey, setLocalUserApiKey] = useState(userGeminiApiKey);
  const [localOllamaUrl, setLocalOllamaUrl] = useState(ollamaUrl);
  const [localChunkDuration, setLocalChunkDuration] = useState(String(chunkDuration));
  const [localOverlapDuration, setLocalOverlapDuration] = useState(String(overlapDuration));
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected');
  const [geminiStatus, setGeminiStatus] = useState<GeminiTestStatus>('idle');
  const [geminiErrorMsg, setGeminiErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalOllamaUrl(ollamaUrl);
    setLocalChunkDuration(String(chunkDuration));
    setLocalOverlapDuration(String(overlapDuration));
    setLocalUserApiKey(userGeminiApiKey);
  }, [ollamaUrl, chunkDuration, overlapDuration, userGeminiApiKey]);

  const checkOllama = async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`/api/ollama-status?ollamaUrl=${encodeURIComponent(localOllamaUrl)}`);
      const data = await res.json();
      setOllamaStatus(data.connected ? 'connected' : 'disconnected');
      if (data.connected && data.models) {
        setOllamaModels(data.models);
      }
    } catch {
      setOllamaStatus('disconnected');
    }
  };

  const testGemini = async () => {
    setGeminiStatus('testing');
    setGeminiErrorMsg('');
    try {
      const params = new URLSearchParams({ model: 'gemini-2.5-flash' });
      if (localUserApiKey) {
        params.set('apiKey', localUserApiKey);
      }

      const res = await fetch(`/api/gemini-test?${params.toString()}`);
      const data = await res.json();

      if (data.connected) {
        setGeminiStatus('connected');
      } else if (data.errorType === 'no_key') {
        setGeminiStatus('error');
        setGeminiErrorMsg('Gemini API key is not configured. Enter your BYOK key above.');
      } else if (data.errorType === 'location_blocked') {
        setGeminiStatus('location_blocked');
        setGeminiErrorMsg(data.suggestion || 'Gemini API is not available in your region.');
      } else if (data.errorType === 'auth_failed') {
        setGeminiStatus('auth_failed');
        setGeminiErrorMsg(data.suggestion || 'Your BYOK key is invalid. Update it in the Gemini API Key field.');
      } else if (data.errorType === 'quota_exceeded') {
        setGeminiStatus('quota_exceeded');
        setGeminiErrorMsg(data.suggestion || 'API quota exceeded.');
      } else {
        setGeminiStatus('error');
        setGeminiErrorMsg(data.error || 'Connection test failed');
      }
    } catch {
      setGeminiStatus('error');
      setGeminiErrorMsg('Failed to test connection. Check your network.');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings = {
        ollamaUrl: localOllamaUrl,
        chunkDuration: parseInt(localChunkDuration) || 300,
        overlapDuration: parseInt(localOverlapDuration) || 10,
        userGeminiApiKey: localUserApiKey,
      };
      setSettings(settings);
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Load settings on open
  useEffect(() => {
    if (open) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
          if (data.ollamaUrl) { setLocalOllamaUrl(data.ollamaUrl); setSettings({ ollamaUrl: data.ollamaUrl }); }
          if (data.chunkDuration) { setLocalChunkDuration(String(data.chunkDuration)); setSettings({ chunkDuration: data.chunkDuration }); }
          if (data.overlapDuration) { setLocalOverlapDuration(String(data.overlapDuration)); setSettings({ overlapDuration: data.overlapDuration }); }
          if (data.userGeminiApiKey) { setLocalUserApiKey(data.userGeminiApiKey); setSettings({ userGeminiApiKey: data.userGeminiApiKey }); }
        })
        .catch(() => {});
      setGeminiStatus('idle');
      setGeminiErrorMsg('');
    }
  }, [open, setSettings]);

  const renderGeminiTestResult = () => {
    switch (geminiStatus) {
      case 'testing':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing connection...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            Connected! Gemini API is working.
          </div>
        );
      case 'location_blocked':
        return (
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
              <Globe className="w-4 h-4" />
              Region Not Supported
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {geminiErrorMsg}
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-start gap-2 p-2 rounded bg-amber-100/50 dark:bg-amber-900/20">
                <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Set up a proxy above</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Enter a proxy URL in the API Base URL field to route through a supported region.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-amber-100/50 dark:bg-amber-900/20">
                <Cpu className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Switch to local model</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Use the Local tab to set up Ollama with a Gemma model for offline transcription.</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'auth_failed':
        return (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Invalid API Key</p>
              <p className="text-xs mt-0.5 opacity-80">{geminiErrorMsg}</p>
            </div>
          </div>
        );
      case 'quota_exceeded':
        return (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Quota Exceeded</p>
              <p className="text-xs mt-0.5 opacity-80">{geminiErrorMsg}</p>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs">{geminiErrorMsg}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your transcription models and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="cloud" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cloud" className="gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Cloud
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Local
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cloud" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="user-api-key">Gemini API Key (BYOK)</Label>
              <Input
                id="user-api-key"
                type="password"
                placeholder="Enter your Gemini API key"
                value={localUserApiKey}
                onChange={(e) => setLocalUserApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
              </p>
            </div>

            {geminiApiKey === '***' && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium">Environment API Key Detected</p>
                <p className="text-xs text-muted-foreground">
                  An environment API key is configured. Your BYOK key will override it when provided.
                </p>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={testGemini}
                disabled={geminiStatus === 'testing' || (!localUserApiKey && geminiApiKey !== '***')}
                className="gap-1.5"
              >
                {geminiStatus === 'testing' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : geminiStatus === 'connected' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Wifi className="w-3.5 h-3.5" />
                )}
                Test Connection
              </Button>
            </div>

            {/* Test Results */}
            {renderGeminiTestResult()}

            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Cloud Models Available:</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">Gemini 2.5 Flash</Badge>
                <Badge variant="outline" className="text-xs">Gemini 2.0 Flash</Badge>
                <Badge variant="outline" className="text-xs">Gemini 1.5 Flash</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cloud models offer the best Bangla-English mixed transcription accuracy.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="local" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ollama-url">Ollama Server URL</Label>
              <div className="flex gap-2">
                <Input
                  id="ollama-url"
                  placeholder="http://localhost:11434"
                  value={localOllamaUrl}
                  onChange={(e) => setLocalOllamaUrl(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={checkOllama}
                  disabled={ollamaStatus === 'checking'}
                >
                  {ollamaStatus === 'checking' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : ollamaStatus === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              </div>
              {ollamaStatus === 'connected' && (
                <p className="text-xs text-emerald-600">Connected to Ollama server</p>
              )}
              {ollamaStatus === 'disconnected' && (
                <p className="text-xs text-destructive">Cannot connect to Ollama. Make sure it&apos;s running.</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Setup Local Models:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                <li>Install Ollama from{' '}
                  <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    ollama.ai
                  </a>
                </li>
                <li>Pull a model:{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ollama pull gemma3:12b</code>
                </li>
                <li>The model will appear in the model selector automatically</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                Recommended for MacBook Air M5 16GB: <strong>gemma3:12b</strong> or <strong>gemma3:4b</strong>
              </p>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-sm space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-400">Important: Local Model Limitations</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Local Gemma models via Ollama currently have limited audio transcription capabilities. They process audio as base64 data but may not provide the same quality as cloud Gemini models. For best Bangla-English mixed transcription with diarization, we recommend using Gemini Flash (cloud) with a proxy if you&apos;re in a restricted region. Local models work as a privacy-preserving offline option for shorter audio clips.
              </p>
            </div>

            {/* Quick switch to local model */}
            {ollamaStatus === 'connected' && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Switch to Local Model</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  Ollama is connected. You can switch to a local model from the model selector in the header.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                  onClick={() => {
                    // Try to set to a local model
                    const ollamaModel = useAppStore.getState().ollamaModels.find(m =>
                      m.includes('gemma3')
                    ) || useAppStore.getState().ollamaModels[0];
                    if (ollamaModel) {
                      setSelectedModel(ollamaModel);
                    }
                  }}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Switch to Local Model
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="chunk-duration">Chunk Duration (seconds)</Label>
              <Input
                id="chunk-duration"
                type="number"
                min="30"
                max="1800"
                value={localChunkDuration}
                onChange={(e) => setLocalChunkDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                How long each audio chunk should be. Larger chunks = better context, but slower per chunk. Default: 300s (5 min)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlap-duration">Overlap Duration (seconds)</Label>
              <Input
                id="overlap-duration"
                type="number"
                min="0"
                max="30"
                value={localOverlapDuration}
                onChange={(e) => setLocalOverlapDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Overlap between chunks to prevent cutting mid-sentence. Default: 10s
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Memory Management</p>
              <p className="text-xs text-muted-foreground">
                For large files (1+ hours), audio is split into chunks and processed sequentially.
                Each chunk is loaded into memory individually, then freed after processing.
                This ensures the app remains efficient even with 1.5-hour audio files.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
