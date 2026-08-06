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
import styles from './settings-dialog.module.css';

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
      <DialogContent className={styles.content}>
        {/* Glowing Top Gradient Header */}
        <div className={styles.header}>
          <div className={styles.glowBlob} />
          <div className={styles.headerRow}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIconWrap}>
                <Cpu className={styles.headerIcon} />
              </div>
              <div>
                <DialogTitle className={styles.titleRow}>
                  AI Provider & GCP Credentials
                  <Badge variant="outline" className={styles.vertexBadge}>
                    Vertex AI Ready
                  </Badge>
                </DialogTitle>
                <DialogDescription className={styles.dialogDesc}>
                  Configure Google Cloud Vertex AI (<code className={styles.dialogDescCode}>gcp-credentials.json</code>) or Gemini API key
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <Tabs defaultValue="vertex" className={styles.tabsWrap}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="vertex" className={`${styles.tabTrigger} ${styles.tabTriggerVertex}`}>
                <Cloud className={styles.iconSm} />
                Option B: Vertex AI & GCP
              </TabsTrigger>
              <TabsTrigger value="gemini" className={`${styles.tabTrigger} ${styles.tabTriggerGemini}`}>
                <Sparkles className={styles.iconSm} />
                Google AI Studio (API Key)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: GCP VERTEX AI (OPTION B) */}
            <TabsContent value="vertex" className={styles.tabContent}>

              {/* Mode Selector Pill cards */}
              <div className={styles.fieldGroup}>
                <Label className={styles.fieldLabel}>
                  <span>Routing Strategy</span>
                  <span className={styles.fieldLabelRight}>Vertex AI Primary</span>
                </Label>

                <div className={styles.modeGrid}>
                  <button
                    type="button"
                    onClick={() => setAiProvider('auto')}
                    className={`${styles.modeCard} ${aiProvider === 'auto' ? `${styles.modeCardAutoActive} ${styles.modeCardActiveRingBlue}` : styles.modeCardIdle}`}
                  >
                    <div className={styles.modeIconRow}>
                      <Zap className={`${styles.modeIcon} ${aiProvider === 'auto' ? styles.modeIconBlue : ''}`} />
                      {aiProvider === 'auto' && <span className={styles.pingDot} />}
                    </div>
                    <div>
                      <p className={styles.modeTitle}>Auto Route</p>
                      <p className={styles.modeSub}>Prefers Vertex JSON if detected</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiProvider('vertex')}
                    className={`${styles.modeCard} ${aiProvider === 'vertex' ? `${styles.modeCardVertexActive} ${styles.modeCardActiveRingBlue}` : styles.modeCardIdle}`}
                  >
                    <div className={styles.modeIconRow}>
                      <Cloud className={`${styles.modeIcon} ${aiProvider === 'vertex' ? styles.modeIconBlue : ''}`} />
                      {aiProvider === 'vertex' && <CheckCircle2 className={styles.modeCheck} />}
                    </div>
                    <div>
                      <p className={styles.modeTitle}>Vertex AI</p>
                      <p className={styles.modeSub}>Enforces Service Account JSON</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiProvider('gemini')}
                    className={`${styles.modeCard} ${aiProvider === 'gemini' ? `${styles.modeCardGeminiActive} ${styles.modeCardActiveRingEmerald}` : styles.modeCardIdle}`}
                  >
                    <div className={styles.modeIconRow}>
                      <Key className={`${styles.modeIcon} ${aiProvider === 'gemini' ? styles.modeIconEmerald : ''}`} />
                      {aiProvider === 'gemini' && <CheckCircle2 className={styles.modeCheckEmerald} />}
                    </div>
                    <div>
                      <p className={styles.modeTitle}>AI Studio</p>
                      <p className={styles.modeSub}>Uses API Key only</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Detected Credentials Pill Banner */}
              {(gcpStatus?.exists || jsonParsedMeta) && (
                <div className={styles.credBanner}>
                  <div className={styles.credInner}>
                    <div className={styles.credLeft}>
                      <div className={styles.credIconWrap}>
                        <ShieldCheck className={styles.credIcon} />
                      </div>
                      <div className={styles.credBody}>
                        <div className={styles.credTitleRow}>
                          <p className={styles.credTitle}>
                            Service Account Credentials Active
                          </p>
                          <Badge variant="outline" className={styles.credBadge}>
                            GCP Validated
                          </Badge>
                        </div>
                        {(gcpStatus?.projectId || jsonParsedMeta?.projectId) && (
                          <p className={styles.credMeta}>
                            Project ID: <code className={styles.credCode}>{gcpStatus?.projectId || jsonParsedMeta?.projectId}</code>
                          </p>
                        )}
                        {(gcpStatus?.clientEmail || jsonParsedMeta?.clientEmail) && (
                          <p className={styles.credAccount}>
                            Account: <code className={styles.credAccountCode}>{gcpStatus?.clientEmail || jsonParsedMeta?.clientEmail}</code>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone for gcp-credentials.json */}
              <div className={styles.fieldGroup}>
                <Label className={styles.jsonLabel}>
                  <span className={styles.jsonLabelLeft}>
                    <FileJson className={styles.jsonLabelIcon} />
                    Upload / Drop <code className={styles.jsonCode}>gcp-credentials.json</code>
                  </span>
                  {gcpCredentialsJson && (
                    <button
                      type="button"
                      onClick={() => { setGcpCredentialsJson(''); setJsonParsedMeta(null); }}
                      className={styles.clearBtn}
                    >
                      <Trash2 className={styles.iconXs} /> Clear JSON
                    </button>
                  )}
                </Label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`${styles.dropZone} ${
                    isDragging
                      ? styles.dropZoneActive
                      : gcpCredentialsJson
                      ? styles.dropZoneLoaded
                      : styles.dropZoneIdle
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className={styles.dropInput}
                  />

                  <div className={styles.dropIconWrap}>
                    <Upload className={styles.dropIcon} />
                  </div>

                  <div>
                    <p className={styles.dropTitle}>
                      {isDragging ? 'Drop gcp-credentials.json here' : 'Click to browse or drag & drop gcp-credentials.json'}
                    </p>
                    <p className={styles.dropSub}>
                      Supports official Google Cloud Service Account key JSON files
                    </p>
                  </div>
                </div>
              </div>

              {/* Paste Textarea Fallback */}
              <div className={styles.pasteGroup}>
                <Label className={styles.pasteLabel}>
                  <Code2 className={styles.pasteIcon} />
                  Or paste Service Account JSON content directly:
                </Label>
                <Textarea
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "my-gcp-project-123",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}`}
                  value={gcpCredentialsJson}
                  onChange={(e) => setGcpCredentialsJson(e.target.value)}
                  className={styles.pasteTextarea}
                />
              </div>

              {/* Project ID & Region Grid */}
              <div className={styles.projGrid}>
                <div className={styles.projCol}>
                  <Label className={styles.projLabel}>
                    <Globe className={styles.projLabelIcon} /> GCP Project ID
                  </Label>
                  <Input
                    placeholder="e.g. my-gcp-project-123"
                    value={gcpProjectId}
                    onChange={(e) => setGcpProjectId(e.target.value)}
                    className={styles.projInput}
                  />
                </div>
                <div className={styles.projCol}>
                  <Label className={styles.projLabel}>
                    <Server className={styles.projLabelIcon} /> GCP Region
                  </Label>
                  <Input
                    placeholder="us-central1"
                    value={gcpLocation}
                    onChange={(e) => setGcpLocation(e.target.value)}
                    className={styles.projInput}
                  />
                </div>
              </div>

              {/* Test Connection Button & Status */}
              <div className={styles.testRow}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testVertex}
                  disabled={vertexStatus === 'testing'}
                  className={styles.testBtn}
                >
                  {vertexStatus === 'testing' ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Wifi className={styles.iconSm} />}
                  Test Vertex AI Connection
                </Button>

                {vertexStatus === 'connected' && (
                  <Badge variant="outline" className={styles.statusBadgeOk}>
                    <CheckCircle2 className={styles.statusBadgeIcon} /> Connected
                  </Badge>
                )}
                {vertexStatus === 'error' && (
                  <Badge variant="outline" className={styles.statusBadgeErr}>
                    <XCircle className={styles.statusBadgeIconErr} /> Failed
                  </Badge>
                )}
              </div>

              {vertexStatus === 'error' && (
                <div className={styles.errorCard}>
                  <p className={styles.errorTitle}>Connection Error:</p>
                  <p className={styles.errorBody}>{vertexError}</p>
                </div>
              )}

              {/* 100% LOCAL PRIVACY GUARANTEE CARD */}
              <div className={styles.privacyCard}>
                <div className={styles.privacyHeader}>
                  <div className={styles.privacyTitle}>
                    <Lock className={styles.privacyIcon} />
                    <span>Privacy & 100% Local Data Sovereignty</span>
                  </div>
                  <Badge variant="outline" className={styles.privacyBadge}>
                    Local Only
                  </Badge>
                </div>
                <div className={styles.privacyList}>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>100% Local File & DB Storage:</strong> All recordings, transcribed text, SQLite database (<code className={styles.dialogDescCode}>dev.db</code>), and settings stay on your machine.</span>
                  </div>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>Zero Google Model Training:</strong> Under Google Cloud Vertex AI terms, your audio & transcripts are <strong>NEVER used to train models</strong> or stored by Google.</span>
                  </div>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>Ephemeral In-Memory Transfer:</strong> Audio is sent in-memory over encrypted TLS during inference and discarded immediately. No GCP cloud buckets (GCS) are used.</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: GEMINI API KEY */}
            <TabsContent value="gemini" className={styles.tabContent}>
              <div className={styles.geminiCard}>
                <div className={styles.geminiHeader}>
                  <div className={styles.geminiTitle}>
                    <Key className={styles.geminiTitleIcon} />
                    <span className={styles.geminiTitleText}>Google AI Studio (Gemini API Key)</span>
                  </div>
                  <Badge variant="outline" className={styles.geminiModeBadge}>
                    API Key Mode
                  </Badge>
                </div>

                <div className={styles.geminiField}>
                  <Label className={styles.advLabel}>API Key</Label>
                  <div className={styles.keyRow}>
                    <Input
                      type="password"
                      placeholder="AIzaSy..."
                      value={localGeminiKey}
                      onChange={e => setLocalGeminiKey(e.target.value)}
                      className={styles.keyInput}
                    />
                    <Button variant="outline" size="sm" onClick={testGemini} disabled={geminiStatus === 'testing'} className={styles.testKeyBtn}>
                      {geminiStatus === 'testing' ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Wifi className={styles.iconSm} />}
                      Test Key
                    </Button>
                  </div>
                </div>

                {geminiStatus === 'connected' && (
                  <p className={styles.geminiOk}>
                    <CheckCircle2 className={styles.iconSm} /> API Key verified & ready!
                  </p>
                )}
                {geminiStatus === 'error' && <p className={styles.geminiErr}>{geminiError}</p>}

                <p className={styles.geminiHint}>
                  Get your free API key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className={styles.geminiLink}>aistudio.google.com <ArrowRight className={styles.linkArrow} /></a>
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Advanced Chunking & Limits Accordion Section */}
          <div className={styles.advSection}>
            <details className={styles.advDetails}>
              <summary className={styles.advSummary}>
                <span className={styles.advSummaryLeft}>
                  <Server className={styles.advSummaryIcon} /> Advanced Audio Slicing & Chunk Settings
                </span>
                <span className={styles.advChevron}>▼</span>
              </summary>
              <div className={styles.advGrid}>
                <div className={styles.advCol}>
                  <Label className={styles.advLabel}>Chunk Duration (seconds)</Label>
                  <Input type="number" min="60" max="3600" value={localChunkDuration} onChange={e => setLocalChunkDuration(e.target.value)} className={styles.advInput} />
                  <p className={styles.advHint}>Default: 300s (5 minutes)</p>
                </div>
                <div className={styles.advCol}>
                  <Label className={styles.advLabel}>Overlap Duration (seconds)</Label>
                  <Input type="number" min="0" max="60" value={localOverlapDuration} onChange={e => setLocalOverlapDuration(e.target.value)} className={styles.advInput} />
                  <p className={styles.advHint}>Default: 30s overlap</p>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <p className={styles.footerHint}>
            Changes will take effect for all future transcription jobs.
          </p>
          <div className={styles.footerBtns}>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className={styles.cancelBtn}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveSettings}
              disabled={saving}
              className={styles.saveBtn}
            >
              {saving ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Check className={styles.iconSm} />}
              Save & Apply Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}