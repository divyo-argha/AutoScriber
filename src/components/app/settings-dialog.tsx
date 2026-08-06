'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Key,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  Cpu,
  FileJson,
  Upload,
  Check,
  ShieldCheck,
  Zap,
  Sparkles,
  Cloud,
  FileText,
  Trash2,
  Globe,
  Lock,
  ArrowRight,
  Code2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TestStatus = 'idle' | 'testing' | 'connected' | 'error';

interface GcpStatus {
  exists: boolean;
  filePath: string | null;
  projectId: string | null;
  clientEmail: string | null;
  location: string;
  source: string;
  error?: string;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const { chunkDuration, overlapDuration, userGeminiApiKey, selectedModel, setSelectedModel, setSettings } = useAppStore();

  const [aiProvider, setAiProvider] = useState<'auto' | 'gemini' | 'vertex'>('auto');
  const [localGeminiKey, setLocalGeminiKey] = useState(userGeminiApiKey);
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpLocation, setGcpLocation] = useState('us-central1');
  const [gcpCredentialsPath, setGcpCredentialsPath] = useState('');
  const [gcpCredentialsJson, setGcpCredentialsJson] = useState('');
  const [gcpStatus, setGcpStatus] = useState<GcpStatus | null>(null);

  const [localChunkDuration, setLocalChunkDuration] = useState(String(chunkDuration));
  const [localOverlapDuration, setLocalOverlapDuration] = useState(String(overlapDuration));
  
  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle');
  const [geminiError, setGeminiError] = useState('');

  const [vertexStatus, setVertexStatus] = useState<TestStatus>('idle');
  const [vertexError, setVertexError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [jsonParsedMeta, setJsonParsedMeta] = useState<{ projectId?: string; clientEmail?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.aiProvider) setAiProvider(data.aiProvider);
        if (data.userGeminiApiKey) {
          setLocalGeminiKey(data.userGeminiApiKey);
          setSettings({ userGeminiApiKey: data.userGeminiApiKey });
        }
        if (data.gcpProjectId) setGcpProjectId(data.gcpProjectId);
        if (data.gcpLocation) setGcpLocation(data.gcpLocation);
        if (data.gcpCredentialsPath) setGcpCredentialsPath(data.gcpCredentialsPath);
        if (data.gcpCredentialsStatus) setGcpStatus(data.gcpCredentialsStatus);

        if (typeof data.chunkDuration === 'number') {
          setLocalChunkDuration(String(data.chunkDuration));
          setSettings({ chunkDuration: data.chunkDuration });
        }
        if (typeof data.overlapDuration === 'number') {
          setLocalOverlapDuration(String(data.overlapDuration));
          setSettings({ overlapDuration: data.overlapDuration });
        }
      })
      .catch(() => {});

    setGeminiStatus('idle');
    setVertexStatus('idle');
  }, [open, setSettings]);

  // Parse custom pasted JSON content live
  useEffect(() => {
    if (!gcpCredentialsJson.trim()) {
      setJsonParsedMeta(null);
      return;
    }
    try {
      const parsed = JSON.parse(gcpCredentialsJson);
      setJsonParsedMeta({
        projectId: parsed.project_id || undefined,
        clientEmail: parsed.client_email || undefined,
      });
    } catch {
      setJsonParsedMeta(null);
    }
  }, [gcpCredentialsJson]);

  const testGemini = async () => {
    setGeminiStatus('testing');
    setGeminiError('');
    try {
      const params = new URLSearchParams({ model: selectedModel || 'gemini-2.0-flash' });
      if (localGeminiKey) params.set('apiKey', localGeminiKey);
      const res = await fetch(`/api/gemini-test?${params}`);
      const data = await res.json();
      if (data.connected) {
        setGeminiStatus('connected');
        if (data.fallbackUsed && data.workingModel) {
          setSelectedModel(data.workingModel);
          toast({
            title: '⚡ Gemini AI Connected',
            description: `Model automatically optimized to ${data.workingModel}.`,
          });
        } else {
          toast({
            title: '✨ Gemini AI Connected',
            description: 'Google AI Studio key verification successful!',
          });
        }
      } else {
        const errMsg = data.error || data.suggestion || 'Connection failed';
        setGeminiStatus('error');
        setGeminiError(errMsg);
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: errMsg,
        });
      }
    } catch {
      setGeminiStatus('error');
      setGeminiError('Network error');
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Unable to reach Gemini API endpoint.',
      });
    }
  };

  const testVertex = async () => {
    setVertexStatus('testing');
    setVertexError('');
    try {
      const body = {
        gcpProjectId,
        gcpLocation,
        gcpCredentialsPath,
        gcpCredentialsJson: gcpCredentialsJson.trim() || undefined,
      };
      const res = await fetch('/api/vertex-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setVertexStatus('connected');
        toast({
          title: '🚀 Vertex AI Connected Successfully!',
          description: `Project: ${data.projectId} • Region: ${data.location}`,
        });
      } else {
        setVertexStatus('error');
        setVertexError(data.error || 'Failed to connect to Vertex AI');
        toast({
          variant: 'destructive',
          title: 'Vertex AI Connection Failed',
          description: data.error || 'Failed to verify GCP Vertex AI credentials.',
        });
      }
    } catch (err: any) {
      setVertexStatus('error');
      setVertexError(err?.message || 'Network error');
      toast({
        variant: 'destructive',
        title: 'Vertex AI Connection Failed',
        description: 'Network error communicating with Vertex API.',
      });
    }
  };

  const processJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setGcpCredentialsJson(content);
      try {
        const parsed = JSON.parse(content);
        if (parsed.project_id && !gcpProjectId) {
          setGcpProjectId(parsed.project_id);
        }
        toast({
          title: '📄 Credentials File Loaded',
          description: `Successfully loaded "${file.name}" (Project: ${parsed.project_id || 'detected'})`,
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Invalid JSON File',
          description: 'The uploaded file is not a valid JSON document.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processJsonFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      processJsonFile(file);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please upload a .json file (gcp-credentials.json).',
      });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const parsedChunk = parseInt(localChunkDuration);
      const parsedOverlap = parseInt(localOverlapDuration);
      const body = {
        aiProvider,
        chunkDuration: isNaN(parsedChunk) ? 300 : parsedChunk,
        overlapDuration: isNaN(parsedOverlap) ? 30 : parsedOverlap,
        userGeminiApiKey: localGeminiKey,
        gcpProjectId,
        gcpLocation,
        gcpCredentialsPath,
        gcpCredentialsJson: gcpCredentialsJson.trim() || undefined,
      };

      setSettings({
        chunkDuration: body.chunkDuration,
        overlapDuration: body.overlapDuration,
        userGeminiApiKey: localGeminiKey,
      });

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.gcpCredentialsStatus) {
        setGcpStatus(data.gcpCredentialsStatus);
      }

      toast({
        title: '✨ Settings Saved',
        description: 'Your AI engine & GCP credentials configuration are up to date.',
      });

      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto border-0 bg-background/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl rounded-2xl p-0 overflow-hidden ring-1 ring-white/10">
        {/* Glowing Top Gradient Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-emerald-600/10 border-b border-white/10">
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 shadow-inner">
                <Cpu className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  AI Provider & GCP Credentials
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-500">
                    Vertex AI Ready
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure Google Cloud Vertex AI (<code className="text-foreground">gcp-credentials.json</code>) or Gemini API key
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-6">
          <Tabs defaultValue="vertex" className="w-full">
            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 dark:bg-zinc-900/80 rounded-xl border border-white/5">
              <TabsTrigger value="vertex" className="gap-2 text-xs font-semibold py-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white shadow-md transition-all">
                <Cloud className="w-3.5 h-3.5" />
                Option B: Vertex AI & GCP
              </TabsTrigger>
              <TabsTrigger value="gemini" className="gap-2 text-xs font-semibold py-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white shadow-md transition-all">
                <Sparkles className="w-3.5 h-3.5" />
                Google AI Studio (API Key)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: GCP VERTEX AI (OPTION B) */}
            <TabsContent value="vertex" className="space-y-5 mt-5 focus-visible:outline-none">

              {/* Mode Selector Pill cards */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Routing Strategy</span>
                  <span className="text-[10px] text-blue-500 font-medium">Vertex AI Primary</span>
                </Label>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAiProvider('auto')}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2 ${
                      aiProvider === 'auto'
                        ? 'border-blue-500/50 bg-blue-500/10 text-foreground ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/5'
                        : 'border-white/10 bg-muted/30 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Zap className={`w-4 h-4 ${aiProvider === 'auto' ? 'text-blue-400' : ''}`} />
                      {aiProvider === 'auto' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Auto Route</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Prefers Vertex JSON if detected</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiProvider('vertex')}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2 ${
                      aiProvider === 'vertex'
                        ? 'border-blue-500/50 bg-blue-500/10 text-foreground ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/5'
                        : 'border-white/10 bg-muted/30 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Cloud className={`w-4 h-4 ${aiProvider === 'vertex' ? 'text-blue-400' : ''}`} />
                      {aiProvider === 'vertex' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Vertex AI</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Enforces Service Account JSON</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiProvider('gemini')}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2 ${
                      aiProvider === 'gemini'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/5'
                        : 'border-white/10 bg-muted/30 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Key className={`w-4 h-4 ${aiProvider === 'gemini' ? 'text-emerald-400' : ''}`} />
                      {aiProvider === 'gemini' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">AI Studio</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Uses API Key only</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Detected Credentials Pill Banner */}
              {(gcpStatus?.exists || jsonParsedMeta) && (
                <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-blue-500/15 p-4 shadow-sm backdrop-blur-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-emerald-400 dark:text-emerald-300">
                            Service Account Credentials Active
                          </p>
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                            GCP Validated
                          </Badge>
                        </div>
                        {(gcpStatus?.projectId || jsonParsedMeta?.projectId) && (
                          <p className="text-xs text-muted-foreground">
                            Project ID: <code className="px-1.5 py-0.5 rounded bg-black/30 text-emerald-200 font-mono text-[11px] font-semibold">{gcpStatus?.projectId || jsonParsedMeta?.projectId}</code>
                          </p>
                        )}
                        {(gcpStatus?.clientEmail || jsonParsedMeta?.clientEmail) && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[400px]">
                            Account: <code className="text-foreground font-mono">{gcpStatus?.clientEmail || jsonParsedMeta?.clientEmail}</code>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone for gcp-credentials.json */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-blue-400" />
                    Upload / Drop <code className="text-xs text-blue-400 font-mono">gcp-credentials.json</code>
                  </span>
                  {gcpCredentialsJson && (
                    <button
                      type="button"
                      onClick={() => { setGcpCredentialsJson(''); setJsonParsedMeta(null); }}
                      className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear JSON
                    </button>
                  )}
                </Label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-500/15 scale-[1.01] shadow-xl shadow-blue-500/10'
                      : gcpCredentialsJson
                      ? 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10'
                      : 'border-white/15 bg-muted/20 hover:border-blue-500/40 hover:bg-muted/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-inner group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      {isDragging ? 'Drop gcp-credentials.json here' : 'Click to browse or drag & drop gcp-credentials.json'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Supports official Google Cloud Service Account key JSON files
                    </p>
                  </div>
                </div>
              </div>

              {/* Paste Textarea Fallback */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-blue-400" />
                  Or paste Service Account JSON content directly:
                </Label>
                <Textarea
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "my-gcp-project-123",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}`}
                  value={gcpCredentialsJson}
                  onChange={(e) => setGcpCredentialsJson(e.target.value)}
                  className="font-mono text-[11px] h-24 resize-none bg-black/30 border-white/10 rounded-xl focus:ring-blue-500/50"
                />
              </div>

              {/* Project ID & Region Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" /> GCP Project ID
                  </Label>
                  <Input
                    placeholder="e.g. my-gcp-project-123"
                    value={gcpProjectId}
                    onChange={(e) => setGcpProjectId(e.target.value)}
                    className="h-9 text-xs bg-black/20 border-white/10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-400" /> GCP Region
                  </Label>
                  <Input
                    placeholder="us-central1"
                    value={gcpLocation}
                    onChange={(e) => setGcpLocation(e.target.value)}
                    className="h-9 text-xs bg-black/20 border-white/10 rounded-xl"
                  />
                </div>
              </div>

              {/* Test Connection Button & Status */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testVertex}
                  disabled={vertexStatus === 'testing'}
                  className="gap-2 text-xs h-9 rounded-xl border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all shadow-sm"
                >
                  {vertexStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  Test Vertex AI Connection
                </Button>

                {vertexStatus === 'connected' && (
                  <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 border-emerald-500/40 text-xs py-1 px-2.5 rounded-lg gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Connected
                  </Badge>
                )}
                {vertexStatus === 'error' && (
                  <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/30 text-xs py-1 px-2.5 rounded-lg gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-destructive" /> Failed
                  </Badge>
                )}
              </div>

              {vertexStatus === 'error' && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                  <p className="font-semibold">Connection Error:</p>
                  <p className="text-[11px] opacity-90">{vertexError}</p>
                </div>
              )}

              {/* 100% LOCAL PRIVACY GUARANTEE CARD */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Privacy & 100% Local Data Sovereignty</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Local Only
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>100% Local File & DB Storage:</strong> All recordings, transcribed text, SQLite database (<code className="text-foreground">dev.db</code>), and settings stay on your machine.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Zero Google Model Training:</strong> Under Google Cloud Vertex AI terms, your audio & transcripts are <strong>NEVER used to train models</strong> or stored by Google.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Ephemeral In-Memory Transfer:</strong> Audio is sent in-memory over encrypted TLS during inference and discarded immediately. No GCP cloud buckets (GCS) are used.</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: GEMINI API KEY */}
            <TabsContent value="gemini" className="space-y-5 mt-5 focus-visible:outline-none">
              <div className="p-4 rounded-xl border border-white/10 bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold">Google AI Studio (Gemini API Key)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    API Key Mode
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">API Key</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="password"
                      placeholder="AIzaSy..."
                      value={localGeminiKey}
                      onChange={e => setLocalGeminiKey(e.target.value)}
                      className="flex-1 h-9 text-xs bg-black/20 border-white/10 rounded-xl"
                    />
                    <Button variant="outline" size="sm" onClick={testGemini} disabled={geminiStatus === 'testing'} className="h-9 gap-1.5 text-xs rounded-xl border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20">
                      {geminiStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                      Test Key
                    </Button>
                  </div>
                </div>

                {geminiStatus === 'connected' && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> API Key verified & ready!
                  </p>
                )}
                {geminiStatus === 'error' && <p className="text-xs text-destructive">{geminiError}</p>}

                <p className="text-[11px] text-muted-foreground pt-1">
                  Get your free API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">aistudio.google.com <ArrowRight className="w-3 h-3" /></a>
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Advanced Chunking & Limits Accordion Section */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <details className="group">
              <summary className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between py-1 transition-colors select-none">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Advanced Audio Slicing & Chunk Settings
                </span>
                <span className="text-[10px] text-primary group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Chunk Duration (seconds)</Label>
                  <Input type="number" min="60" max="3600" value={localChunkDuration} onChange={e => setLocalChunkDuration(e.target.value)} className="h-8 text-xs bg-black/20 border-white/10 rounded-xl" />
                  <p className="text-[10px] text-muted-foreground">Default: 300s (5 minutes)</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Overlap Duration (seconds)</Label>
                  <Input type="number" min="0" max="60" value={localOverlapDuration} onChange={e => setLocalOverlapDuration(e.target.value)} className="h-8 text-xs bg-black/20 border-white/10 rounded-xl" />
                  <p className="text-[10px] text-muted-foreground">Default: 30s overlap</p>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 px-6 bg-muted/40 border-t border-white/10">
          <p className="text-[11px] text-muted-foreground">
            Changes will take effect for all future transcription jobs.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveSettings}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 rounded-xl text-xs font-semibold px-4 gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save & Apply Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
