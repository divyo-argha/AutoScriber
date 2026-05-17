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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Key, Server, Cpu, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    geminiApiKey,
    ollamaUrl,
    chunkDuration,
    overlapDuration,
    setSettings,
    setOllamaModels,
  } = useAppStore();
  
  const [localApiKey, setLocalApiKey] = useState(geminiApiKey);
  const [localOllamaUrl, setLocalOllamaUrl] = useState(ollamaUrl);
  const [localChunkDuration, setLocalChunkDuration] = useState(String(chunkDuration));
  const [localOverlapDuration, setLocalOverlapDuration] = useState(String(overlapDuration));
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    setLocalApiKey(geminiApiKey);
    setLocalOllamaUrl(ollamaUrl);
    setLocalChunkDuration(String(chunkDuration));
    setLocalOverlapDuration(String(overlapDuration));
  }, [geminiApiKey, ollamaUrl, chunkDuration, overlapDuration]);
  
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
  
  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings = {
        geminiApiKey: localApiKey,
        ollamaUrl: localOllamaUrl,
        chunkDuration: parseInt(localChunkDuration) || 300,
        overlapDuration: parseInt(localOverlapDuration) || 10,
      };
      
      setSettings(settings);
      
      // Save to database
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
          if (data.geminiApiKey) {
            setLocalApiKey(data.geminiApiKey);
            setSettings({ geminiApiKey: data.geminiApiKey });
          }
          if (data.ollamaUrl) {
            setLocalOllamaUrl(data.ollamaUrl);
            setSettings({ ollamaUrl: data.ollamaUrl });
          }
          if (data.chunkDuration) {
            setLocalChunkDuration(String(data.chunkDuration));
            setSettings({ chunkDuration: data.chunkDuration });
          }
          if (data.overlapDuration) {
            setLocalOverlapDuration(String(data.overlapDuration));
            setSettings({ overlapDuration: data.overlapDuration });
          }
        })
        .catch(() => {});
    }
  }, [open, setSettings]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="Enter your Gemini API key"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Cloud Models Available:</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">Gemini 2.5 Flash</Badge>
                <Badge variant="outline" className="text-xs">Gemini 2.0 Flash</Badge>
                <Badge variant="outline" className="text-xs">Gemini 2.0 Flash Lite</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cloud models offer the best Bangla-English mixed transcription accuracy with native speaker diarization and timestamps.
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
              <p className="font-medium text-amber-700 dark:text-amber-400">Note on Local Models</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Local Gemma models via Ollama may have limited audio transcription capabilities compared to cloud Gemini models. 
                For best Bangla-English mixed transcription with diarization, we recommend using Gemini Flash (cloud). 
                Local models work well for shorter audio clips and as a privacy-preserving offline option.
              </p>
            </div>
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
