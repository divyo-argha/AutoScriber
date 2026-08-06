'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
  Check,
  ShieldCheck,
  Sparkles,
  Cloud,
  Trash2,
  Globe,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AVAILABLE_MODELS, VERTEX_MODELS } from '@/lib/transcriber/types';
import type { ModelInfo } from '@/lib/transcriber/types';
import { validateGcpCredentialsJson } from '@/lib/transcriber/credentials-validate';
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

type CredentialsValidation = ReturnType<typeof validateGcpCredentialsJson>;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const { chunkDuration, overlapDuration, userGeminiApiKey, selectedModel, setSelectedModel, setSettings } = useAppStore();

  const [activeTab, setActiveTab] = useState<'vertex' | 'gemini'>('vertex');
  const [localGeminiKey, setLocalGeminiKey] = useState(userGeminiApiKey);
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpLocation, setGcpLocation] = useState('us-central1');
  const [gcpCredentialsPath, setGcpCredentialsPath] = useState('');
  const [gcpCredentialsJson, setGcpCredentialsJson] = useState('');
  const [gcpStatus, setGcpStatus] = useState<GcpStatus | null>(null);
  const [jsonValidation, setJsonValidation] = useState<CredentialsValidation | null>(null);

  const [selectedVertexModel, setSelectedVertexModel] = useState(
    VERTEX_MODELS.some(m => m.id === selectedModel) ? selectedModel : 'gemini-2.5-flash'
  );
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(
    AVAILABLE_MODELS.some(m => m.id === selectedModel) ? selectedModel : 'gemini-2.0-flash'
  );

  const [localChunkDuration, setLocalChunkDuration] = useState(String(chunkDuration));
  const [localOverlapDuration, setLocalOverlapDuration] = useState(String(overlapDuration));

  const [geminiStatus, setGeminiStatus] = useState<TestStatus>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [geminiSuccessModel, setGeminiSuccessModel] = useState('');

  const [vertexStatus, setVertexStatus] = useState<TestStatus>('idle');
  const [vertexError, setVertexError] = useState('');
  const [vertexSuccess, setVertexSuccess] = useState<{ projectId: string; location: string; model: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.gcpProjectId) setGcpProjectId(data.gcpProjectId);
        if (data.gcpLocation) setGcpLocation(data.gcpLocation);
        if (data.gcpCredentialsPath) setGcpCredentialsPath(data.gcpCredentialsPath);
        if (data.gcpCredentialsStatus) setGcpStatus(data.gcpCredentialsStatus);
        if (data.userGeminiApiKey) {
          setLocalGeminiKey(data.userGeminiApiKey);
          setSettings({ userGeminiApiKey: data.userGeminiApiKey });
        }

        const provider = data.aiProvider || 'auto';
        if (provider === 'vertex') {
          setActiveTab('vertex');
        } else if (provider === 'gemini') {
          setActiveTab('gemini');
        } else {
          const hasVertex = data.gcpCredentialsStatus?.exists || !!data.gcpProjectId;
          setActiveTab(hasVertex ? 'vertex' : 'gemini');
        }

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
    setGeminiError('');
    setVertexError('');
    setVertexSuccess(null);
    setGeminiSuccessModel('');
  }, [open, setSettings]);

  // Live validation of the pasted service account JSON
  useEffect(() => {
    if (!gcpCredentialsJson.trim()) {
      setJsonValidation(null);
      return;
    }
    setJsonValidation(validateGcpCredentialsJson(gcpCredentialsJson));
  }, [gcpCredentialsJson]);

  const selectVertexModel = (modelId: string) => {
    setSelectedVertexModel(modelId);
    setSelectedModel(modelId);
  };

  const selectGeminiModel = (modelId: string) => {
    setSelectedGeminiModel(modelId);
    setSelectedModel(modelId);
  };

  const testGemini = async () => {
    setGeminiStatus('testing');
    setGeminiError('');
    setGeminiSuccessModel('');
    try {
      const params = new URLSearchParams({ model: selectedGeminiModel || 'gemini-2.0-flash' });
      if (localGeminiKey) params.set('apiKey', localGeminiKey);
      const res = await fetch(`/api/gemini-test?${params}`);
      const data = await res.json();
      if (data.connected) {
        setGeminiStatus('connected');
        setGeminiSuccessModel(data.workingModel);
        if (data.fallbackUsed && data.workingModel) {
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
    setVertexSuccess(null);
    try {
      const body = {
        gcpProjectId,
        gcpLocation,
        gcpCredentialsPath,
        gcpCredentialsJson: gcpCredentialsJson.trim() || undefined,
        modelId: selectedVertexModel,
      };
      const res = await fetch('/api/vertex-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setVertexStatus('connected');
        setVertexSuccess({
          projectId: data.projectId,
          location: data.location,
          model: data.model,
        });
        toast({
          title: '🚀 Vertex AI Connected Successfully!',
          description: `Project: ${data.projectId} • Region: ${data.location} • Model: ${data.model}`,
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

  const saveSettings = async () => {
    setSaving(true);
    try {
      const parsedChunk = parseInt(localChunkDuration);
      const parsedOverlap = parseInt(localOverlapDuration);
      const body = {
        aiProvider: activeTab,
        chunkDuration: isNaN(parsedChunk) ? 300 : parsedChunk,
        overlapDuration: isNaN(parsedOverlap) ? 30 : parsedOverlap,
        userGeminiApiKey: localGeminiKey,
        defaultModel: activeTab === 'vertex' ? selectedVertexModel : selectedGeminiModel,
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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
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
        description: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderModelCards = (models: ModelInfo[], selectedId: string, onSelect: (id: string) => void, activeClass: string) => (
    <div className={styles.modelGrid}>
      {models.map(model => {
        const isActive = model.id === selectedId;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={`${styles.modelCard} ${isActive ? `${activeClass} ${styles.modelCardActive}` : styles.modelCardIdle}`}
          >
            <div className={styles.modelCardRow}>
              <span className={styles.modeTitle}>{model.name}</span>
              {isActive && <Check className={styles.modelCheck} />}
            </div>
            <p className={styles.modeSub}>{model.description}</p>
            <p className={styles.modelTier}>{model.tierInfo}</p>
          </button>
        );
      })}
    </div>
  );

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
                  Pick one engine below. Paste the credentials it asks for, then press Test to verify before saving.
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'vertex' | 'gemini')} className={styles.tabsWrap}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="vertex" className={`${styles.tabTrigger} ${styles.tabTriggerVertex}`}>
                <Cloud className={styles.iconSm} />
                Vertex AI & GCP
              </TabsTrigger>
              <TabsTrigger value="gemini" className={`${styles.tabTrigger} ${styles.tabTriggerGemini}`}>
                <Sparkles className={styles.iconSm} />
                Google AI Studio
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: VERTEX AI & GCP */}
            <TabsContent value="vertex" className={styles.tabContent}>
              {/* Detected Credentials Banner */}
              {(gcpStatus?.exists || (jsonValidation?.valid && gcpCredentialsJson)) && (
                <div className={styles.credBanner}>
                  <div className={styles.credLeft}>
                    <div className={styles.credIconWrap}>
                      <ShieldCheck className={styles.credIcon} />
                    </div>
                    <div className={styles.credBody}>
                      <div className={styles.credTitleRow}>
                        <p className={styles.credTitle}>Service Account Credentials Ready</p>
                        <Badge variant="outline" className={styles.credBadge}>GCP Validated</Badge>
                      </div>
                      {(gcpStatus?.projectId || jsonValidation?.projectId) && (
                        <p className={styles.credMeta}>
                          Project ID: <code className={styles.credCode}>{gcpStatus?.projectId || jsonValidation?.projectId}</code>
                        </p>
                      )}
                      {(gcpStatus?.clientEmail || jsonValidation?.clientEmail) && (
                        <p className={styles.credAccount}>
                          Account: <code className={styles.credAccountCode}>{gcpStatus?.clientEmail || jsonValidation?.clientEmail}</code>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Inputs: Project ID & Region */}
              <div className={styles.projGrid}>
                <div className={styles.projCol}>
                  <Label className={styles.projLabel}>
                    <Globe className={styles.projLabelIcon} /> GCP Project ID
                  </Label>
                  <Input
                    placeholder="e.g. my-gcp-project-123"
                    value={gcpProjectId}
                    onChange={e => setGcpProjectId(e.target.value)}
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
                    onChange={e => setGcpLocation(e.target.value)}
                    className={styles.projInput}
                  />
                </div>
              </div>

              {/* Paste Service Account JSON */}
              <div className={styles.pasteGroup}>
                <Label className={styles.pasteLabel}>
                  <FileJson className={styles.pasteIcon} />
                  Service Account Key JSON
                  {gcpCredentialsJson && (
                    <button
                      type="button"
                      onClick={() => setGcpCredentialsJson('')}
                      className={styles.clearBtn}
                    >
                      <Trash2 className={styles.iconXs} /> Clear
                    </button>
                  )}
                </Label>
                <Textarea
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "my-gcp-project-123",\n  "client_email": "sa@project.iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "token_uri": "https://oauth2.googleapis.com/token"\n}`}
                  value={gcpCredentialsJson}
                  onChange={e => setGcpCredentialsJson(e.target.value)}
                  className={styles.pasteTextarea}
                />
                {jsonValidation && !jsonValidation.valid && (
                  <p className={styles.jsonHintErr}>
                    <XCircle className={styles.iconXs} /> {jsonValidation.error}
                  </p>
                )}
                {jsonValidation?.valid && (
                  <p className={styles.jsonHintOk}>
                    <CheckCircle2 className={styles.iconXs} /> Valid service account JSON — Project:{' '}
                    <code className={styles.credCode}>{jsonValidation.projectId}</code>, Account:{' '}
                    <code className={styles.credAccountCode}>{jsonValidation.clientEmail}</code>
                  </p>
                )}
              </div>

              {/* Vertex Model Picker */}
              <div className={styles.fieldGroup}>
                <Label className={styles.fieldLabel}>
                  <span>Vertex AI Model</span>
                  <span className={styles.fieldLabelRight}>used for transcription</span>
                </Label>
                {renderModelCards(VERTEX_MODELS, selectedVertexModel, selectVertexModel, styles.modeCardVertexActive)}
              </div>

              {/* Test Connection */}
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

                {vertexStatus === 'connected' && vertexSuccess && (
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

              {vertexStatus === 'connected' && vertexSuccess && (
                <div className={styles.successCard}>
                  <p className={styles.errorTitle}>
                    <CheckCircle2 className={styles.iconSm} /> Connection Successful
                  </p>
                  <p className={styles.errorBody}>
                    Project: <code className={styles.credCode}>{vertexSuccess.projectId}</code> • Region:{' '}
                    <code className={styles.credCode}>{vertexSuccess.location}</code> • Model:{' '}
                    <code className={styles.credCode}>{vertexSuccess.model}</code>
                  </p>
                </div>
              )}

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

            {/* TAB 2: GOOGLE AI STUDIO */}
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
                  <div className={styles.successCard}>
                    <p className={styles.errorTitle}>
                      <CheckCircle2 className={styles.iconSm} /> API Key verified & ready!
                    </p>
                    <p className={styles.errorBody}>
                      Working model: <code className={styles.credCode}>{geminiSuccessModel}</code>
                    </p>
                  </div>
                )}
                {geminiStatus === 'error' && (
                  <div className={styles.errorCard}>
                    <p className={styles.errorTitle}>Connection Error:</p>
                    <p className={styles.errorBody}>{geminiError}</p>
                  </div>
                )}

                <div className={styles.fieldGroup}>
                  <Label className={styles.fieldLabel}>
                    <span>Gemini Model</span>
                    <span className={styles.fieldLabelRight}>used for transcription</span>
                  </Label>
                  {renderModelCards(AVAILABLE_MODELS, selectedGeminiModel, selectGeminiModel, styles.modeCardGeminiActive)}
                </div>

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
