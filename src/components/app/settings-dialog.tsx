'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Key, Server, CheckCircle2, XCircle, Loader2, Wifi } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TestStatus = 'idle' | 'testing' | 'connected' | 'error';

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { chunkDuration, overlapDuration, userGeminiApiKey, selectedModel, setSettings } = useAppStore();

  const [localGeminiKey, setLocalGeminiKey] = useState(userGeminiApiKey);
  const [localChunkDuration, setLocalChunkDuration] = useState(String(chunkDuration));
  const [localOverlapDuration, setLocalOverlapDuration] = useState(String(overlapDuration));
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.userGeminiApiKey) { setLocalGeminiKey(data.userGeminiApiKey); setSettings({ userGeminiApiKey: data.userGeminiApiKey }); }
      if (data.chunkDuration) { setLocalChunkDuration(String(data.chunkDuration)); setSettings({ chunkDuration: data.chunkDuration }); }
      if (data.overlapDuration) { setLocalOverlapDuration(String(data.overlapDuration)); setSettings({ overlapDuration: data.overlapDuration }); }
    }).catch(() => {});
    setGeminiStatus('idle');
  }, [open, setSettings]);

  const testGemini = async () => {
    setGeminiStatus('testing'); setGeminiError('');
    try {
      const params = new URLSearchParams({ model: selectedModel || 'gemini-2.0-flash' });
      if (localGeminiKey) params.set('apiKey', localGeminiKey);
      const res = await fetch(`/api/gemini-test?${params}`);
      const data = await res.json();
      if (data.connected) {
        setGeminiStatus('connected');
        toast({
          title: 'Connection Successful',
          description: 'Gemini API connection test passed!',
        });
      } else {
        const errMsg = data.error || data.suggestion || 'Connection failed';
        setGeminiStatus('error');
        setGeminiError(errMsg);
        toast({
          variant: 'destructive',
          title: 'Connection Failed',
          description: errMsg,
        });
      }
    } catch {
      setGeminiStatus('error');
      setGeminiError('Network error');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Network error',
      });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const body = {
        chunkDuration: parseInt(localChunkDuration) || 300,
        overlapDuration: parseInt(localOverlapDuration) || 30,
        userGeminiApiKey: localGeminiKey,
      };
      setSettings({ chunkDuration: body.chunkDuration, overlapDuration: body.overlapDuration, userGeminiApiKey: localGeminiKey });
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onOpenChange(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure Gemini API key and transcription preferences</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="keys" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="keys" className="gap-1.5"><Key className="w-3.5 h-3.5" />API Keys</TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5"><Server className="w-3.5 h-3.5" />Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-5 mt-4">
            {/* Gemini */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Gemini API Key</Label>
                <Badge variant="outline" className="text-xs">☁️ Google</Badge>
              </div>
              <div className="flex gap-2 items-center">
                <Input type="password" placeholder="AIza... or AQ..." value={localGeminiKey} onChange={e => setLocalGeminiKey(e.target.value)} className="flex-1" />
                <Button variant="outline" size="icon" onClick={testGemini} disabled={geminiStatus === 'testing'}>
                  {geminiStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                </Button>
                {geminiStatus === 'connected' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {geminiStatus === 'error' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
              </div>
              {geminiStatus === 'error' && <p className="text-xs text-destructive">{geminiError}</p>}
              <p className="text-xs text-muted-foreground">
                Free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aistudio.google.com</a>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">AI Studio Free Tier Models:</p>
              <p>• <strong>Gemini 2.5 Flash</strong> (Recommended) — 10 RPM / 250 RPD</p>
              <p>• <strong>Gemini 2.0 Flash</strong> — 15 RPM / 1,500 RPD</p>
              <p>• <strong>Gemini 2.0 Flash Lite</strong> — 30 RPM / 1,500 RPD</p>
              <p>• <strong>Gemini 1.5 Flash</strong> — 15 RPM / 1,500 RPD</p>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Chunk Duration (seconds)</Label>
              <Input type="number" min="60" max="3600" value={localChunkDuration} onChange={e => setLocalChunkDuration(e.target.value)} />
              <p className="text-xs text-muted-foreground">Length of core audio chunk. Default: 300s (5 minutes)</p>
            </div>
            <div className="space-y-2">
              <Label>Overlap Duration (seconds)</Label>
              <Input type="number" min="0" max="60" value={localOverlapDuration} onChange={e => setLocalOverlapDuration(e.target.value)} />
              <p className="text-xs text-muted-foreground">Overlap duration at start and end of chunks to prevent missing words. Default: 30s</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
