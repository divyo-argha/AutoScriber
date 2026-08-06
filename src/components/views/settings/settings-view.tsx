'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
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
  ArrowLeft,
  Gauge,
  ChevronDown,
  RotateCcw,
  Activity,
  Radio,
  Zap,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AVAILABLE_MODELS, VERTEX_MODELS } from '@/lib/transcriber/types';
import type { ModelInfo } from '@/lib/transcriber/types';
import { validateGcpCredentialsJson } from '@/lib/transcriber/credentials-validate';
import styles from './settings-view.module.css';

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

export function SettingsView() {
  const { toast } = useToast();
  const { chunkDuration, overlapDuration, userGeminiApiKey, selectedModel, setSelectedModel, setSettings, setCurrentView } = useAppStore();

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
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleCleanupStorage = async () => {
    setCleaningStorage(true);
    try {
      const res = await fetch('/api/audio/cleanup', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Storage Cleaned',
          description: `Removed ${data.filesDeleted} orphan audio files (${data.formattedFreed || '0 MB'} freed).`,
        });
      } else {
        toast({
          title: 'Cleanup Failed',
          description: data.error || 'Failed to clean storage',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Cleanup Error',
        description: err instanceof Error ? err.message : 'Storage cleanup failed',
        variant: 'destructive',
      });
    } finally {
      setCleaningStorage(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.gcpProjectId) setGcpProjectId(data.gcpProjectId);
        if (data.gcpLocation) setGcpLocation(data.gcpLocation);
        if (data.gcpCredentialsPath) setGcpCredentialsPath(data.gcpCredentialsPath);
        if (data.gcpCredentialsStatus) setGcpStatus(data.gcpCredentialsStatus);
        if (data.gcpCredentialsStatus?.projectId && !data.gcpProjectId) {
          setGcpProjectId(data.gcpCredentialsStatus.projectId);
        }
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
  }, [setSettings]);

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

  const resetAdvanced = () => {
    setLocalChunkDuration('300');
    setLocalOverlapDuration('30');
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const parsedChunk = parseInt(localChunkDuration);
      const parsedOverlap = parseInt(localOverlapDuration);
      const projectIdFromJson = jsonValidation?.valid ? jsonValidation.projectId : null;
      const body = {
        aiProvider: activeTab,
        chunkDuration: isNaN(parsedChunk) ? 300 : parsedChunk,
        overlapDuration: isNaN(parsedOverlap) ? 30 : parsedOverlap,
        userGeminiApiKey: localGeminiKey,
        defaultModel: activeTab === 'vertex' ? selectedVertexModel : selectedGeminiModel,
        gcpProjectId: projectIdFromJson || gcpProjectId,
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

      setCurrentView('upload');
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

  const activeModelInfo = activeTab === 'vertex'
    ? VERTEX_MODELS.find(m => m.id === selectedVertexModel)
    : AVAILABLE_MODELS.find(m => m.id === selectedGeminiModel);

  return (
    <div className={styles.page}>
      {/* Sticky top toolbar */}
      <div className={styles.toolbar}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('upload')}
          className={styles.backBtn}
        >
          <ArrowLeft className={styles.iconSm} />
          Back to App
        </Button>
        <div className={styles.toolbarCenter}>
          <span className={styles.toolbarTitle}>Settings</span>
          <span className={styles.toolbarChip}>
            <Activity className={styles.toolbarChipIcon} />
            {activeTab === 'vertex' ? 'Vertex AI' : 'AI Studio'}
          </span>
        </div>
        <span className={styles.toolbarSpacer} />
      </div>

      <div className={styles.content}>
        {/* Hero header */}
        <div className={styles.header}>
          <div className={styles.glowBlob} />
          <div className={styles.glowBlob2} />
          <div className={styles.headerRow}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIconWrap}>
                <Cpu className={styles.headerIcon} />
              </div>
              <div>
                <h1 className={styles.titleRow}>
                  Transcription Engine
                  {activeTab === 'vertex' ? (
                    <Badge variant="outline" className={styles.vertexBadge}>
                      <Cloud className={styles.iconXs} /> Vertex AI Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={styles.geminiBadge}>
                      <Sparkles className={styles.iconXs} /> API Key Mode
                    </Badge>
                  )}
                </h1>
                <p className={styles.dialogDesc}>
                  Choose how AutoScriber transcribes. Configure credentials, pick a model, then verify with one click.
                </p>
              </div>
            </div>
            {activeModelInfo && (
              <div className={styles.headerStatus}>
                <span className={styles.headerStatusLabel}>Active model</span>
                <span className={styles.headerStatusValue}>{activeModelInfo.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.body}>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'vertex' | 'gemini')} className={styles.tabsWrap}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="vertex" className={`${styles.tabTrigger} ${styles.tabTriggerVertex}`}>
                <span className={styles.tabTriggerTop}>
                  <Cloud className={styles.iconSm} />
                  Vertex AI & GCP
                </span>
                <span className={styles.tabTriggerSub}>Service account credentials</span>
              </TabsTrigger>
              <TabsTrigger value="gemini" className={`${styles.tabTrigger} ${styles.tabTriggerGemini}`}>
                <span className={styles.tabTriggerTop}>
                  <Sparkles className={styles.iconSm} />
                  Google AI Studio
                </span>
                <span className={styles.tabTriggerSub}>Gemini API key</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: VERTEX AI & GCP */}
            <TabsContent value="vertex" className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHead} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                    <div className={styles.cardHeadIcon} style={{ color: 'var(--brand-400)' }}>
                      <ShieldCheck className={styles.iconMd} />
                    </div>
                    <div>
                      <p className={styles.cardTitle}>Service Account Key & Region</p>
                      <p className={styles.cardDesc}>Paste your GCP Service Account JSON key. Project ID is auto-extracted.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Label className={styles.projLabel} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>GCP Region:</Label>
                    <Input
                      placeholder="us-central1"
                      value={gcpLocation}
                      onChange={e => setGcpLocation(e.target.value)}
                      className={styles.projInput}
                      style={{ width: '130px', height: '2.1rem' }}
                    />
                  </div>
                </div>

                {gcpStatus?.exists && (
                  <div className={styles.credBanner}>
                    <div className={styles.credLeft}>
                      <div className={styles.credIconWrap}>
                        <CheckCircle2 className={styles.credIcon} />
                      </div>
                      <div className={styles.credBody}>
                        <div className={styles.credTitleRow}>
                          <p className={styles.credTitle}>Detected at {gcpStatus.source}</p>
                          <Badge variant="outline" className={styles.credBadge}>GCP Validated</Badge>
                        </div>
                        {(gcpStatus?.projectId || gcpStatus?.clientEmail) && (
                          <p className={styles.credMeta}>
                            {gcpStatus?.projectId && <code className={styles.credCode}>{gcpStatus.projectId}</code>}
                            {gcpStatus?.projectId && gcpStatus?.clientEmail && ' • '}
                            {gcpStatus?.clientEmail && <code className={styles.credCode}>{gcpStatus.clientEmail}</code>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.pasteGroup}>
                  <Label className={styles.pasteLabel}>
                    <span className={styles.pasteLabelLeft}>
                      <FileJson className={styles.pasteIcon} /> Service Account Key JSON
                    </span>
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
                    <div className={styles.jsonBad}>
                      <p className={styles.jsonHintErr}>
                        <XCircle className={styles.iconXs} /> {jsonValidation.error}
                      </p>
                      {jsonValidation.missingFields.length > 0 && (
                        <div className={styles.jsonFieldChips}>
                          {jsonValidation.missingFields.map(field => (
                            <span key={field} className={styles.jsonChip}>
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {jsonValidation?.valid && (
                    <div className={styles.jsonBad}>
                      <p className={styles.jsonHintOk}>
                        <CheckCircle2 className={styles.iconXs} /> Valid service account JSON — Project:{' '}
                        <code className={styles.credCode}>{jsonValidation.projectId}</code>, Account:{' '}
                        <code className={styles.credCode}>{jsonValidation.clientEmail}</code>
                      </p>
                      {jsonValidation.warnings?.map(warning => (
                        <p key={warning} className={styles.jsonWarn}>
                          <AlertTriangle className={styles.iconXs} /> {warning}
                        </p>
                      ))}
                    </div>
                  )}
                  {!gcpCredentialsJson && !gcpStatus?.exists && (
                    <p className={styles.jsonHint}>
                      <FileJson className={styles.iconXs} /> Tip: download the key from GCP Console → IAM → Service Accounts → Keys → Add Key → JSON.
                    </p>
                  )}
                </div>
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
                  {vertexStatus === 'testing' ? (
                    <>
                      <Loader2 className={`${styles.iconSm} ${styles.spin}`} />
                      Testing connection…
                    </>
                  ) : (
                    <>
                      <Wifi className={styles.iconSm} />
                      Test Vertex AI Connection
                    </>
                  )}
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
                  <div className={styles.successHead}>
                    <CheckCircle2 className={styles.successIcon} />
                    <div>
                      <p className={styles.errorTitle}>Connection Successful</p>
                      <p className={styles.errorBody}>
                        Project: <code className={styles.credCode}>{vertexSuccess.projectId}</code> • Region:{' '}
                        <code className={styles.credCode}>{vertexSuccess.location}</code> • Model:{' '}
                        <code className={styles.credCode}>{vertexSuccess.model}</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {vertexStatus === 'error' && (
                <div className={styles.errorCard}>
                  <div className={styles.errorHead}>
                    <XCircle className={styles.errorIcon} />
                    <div>
                      <p className={styles.errorTitle}>Connection Error</p>
                      <p className={styles.errorBody}>{vertexError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy card */}
              <div className={styles.privacyCard}>
                <div className={styles.privacyHeader}>
                  <div className={styles.privacyTitle}>
                    <Lock className={styles.privacyIcon} />
                    <span>100% Local Data Sovereignty</span>
                  </div>
                  <Badge variant="outline" className={styles.privacyBadge}>
                    Local Only
                  </Badge>
                </div>
                <div className={styles.privacyList}>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>Local file & DB storage:</strong> Recordings, transcripts, and the SQLite database stay on your machine.</span>
                  </div>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>Zero model training:</strong> Under Google Vertex AI terms, your audio & transcripts are never used to train models.</span>
                  </div>
                  <div className={styles.privacyItem}>
                    <Check className={styles.privacyCheck} />
                    <span><strong>Ephemeral transfer:</strong> Audio is sent in-memory over TLS and discarded immediately — no GCS buckets used.</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: GOOGLE AI STUDIO */}
            <TabsContent value="gemini" className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.cardHeadIcon} style={{ color: 'var(--brand-400)' }}>
                    <Key className={styles.iconMd} />
                  </div>
                  <div>
                    <p className={styles.cardTitle}>Gemini API Key</p>
                    <p className={styles.cardDesc}>Generate a free key at AI Studio, paste it below and verify.</p>
                  </div>
                </div>
                <div className={styles.geminiField}>
                  <Label className={styles.advLabel}>API Key</Label>
                  <div className={styles.keyRow}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="AIzaSy..."
                        value={localGeminiKey}
                        onChange={e => setLocalGeminiKey(e.target.value)}
                        className={styles.keyInput}
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--muted-foreground)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showApiKey ? <EyeOff className={styles.iconSm} /> : <Eye className={styles.iconSm} />}
                      </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={testGemini} disabled={geminiStatus === 'testing'} className={styles.testKeyBtn}>
                      {geminiStatus === 'testing' ? (
                        <>
                          <Loader2 className={`${styles.iconSm} ${styles.spin}`} />
                          Testing…
                        </>
                      ) : (
                        <>
                          <Wifi className={styles.iconSm} />
                          Test Key
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {geminiStatus === 'connected' && (
                  <div className={styles.successCard}>
                    <div className={styles.successHead}>
                      <CheckCircle2 className={styles.successIcon} />
                      <div>
                        <p className={styles.errorTitle}>API Key verified & ready!</p>
                        <p className={styles.errorBody}>
                          Working model: <code className={styles.credCode}>{geminiSuccessModel}</code>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {geminiStatus === 'error' && (
                  <div className={styles.errorCard}>
                    <div className={styles.errorHead}>
                      <XCircle className={styles.errorIcon} />
                      <div>
                        <p className={styles.errorTitle}>Connection Error</p>
                        <p className={styles.errorBody}>{geminiError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <p className={styles.geminiHint}>
                  Get your free API key at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className={styles.geminiLink}>
                    aistudio.google.com <ArrowRight className={styles.linkArrow} />
                  </a>
                </p>
              </div>

            </TabsContent>
          </Tabs>

          {/* Advanced Chunking & Limits Accordion Section */}
          <div className={styles.advSection}>
            <details className={styles.advDetails}>
              <summary className={styles.advSummary}>
                <span className={styles.advSummaryLeft}>
                  <Gauge className={styles.advSummaryIcon} /> Advanced Audio Slicing & Chunk Settings
                </span>
                <ChevronDown className={styles.advChevron} />
              </summary>
              <div className={styles.advGrid}>
                <div className={styles.advCol}>
                  <Label className={styles.advLabel}>Chunk Duration (seconds)</Label>
                  <div className={styles.advInputWrap}>
                    <Input type="number" min="60" max="3600" value={localChunkDuration} onChange={e => setLocalChunkDuration(e.target.value)} className={styles.advInput} />
                    <span className={styles.advUnit}>sec</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                    {[{ label: '3 Min', val: '180' }, { label: '5 Min (Default)', val: '300' }, { label: '10 Min', val: '600' }].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setLocalChunkDuration(preset.val)}
                        style={{
                          fontSize: '10px',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          border: localChunkDuration === preset.val ? '1px solid var(--brand-500)' : '1px solid color-mix(in oklab, var(--white) 10%, transparent)',
                          backgroundColor: localChunkDuration === preset.val ? 'color-mix(in oklab, var(--brand-500) 15%, transparent)' : 'color-mix(in oklab, var(--muted) 40%, transparent)',
                          color: localChunkDuration === preset.val ? 'var(--brand-400)' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className={styles.advHint} style={{ marginTop: '0.375rem' }}>Long audio is split into chunks of this size for high accuracy.</p>
                </div>
                <div className={styles.advCol}>
                  <Label className={styles.advLabel}>Overlap Duration (seconds)</Label>
                  <div className={styles.advInputWrap}>
                    <Input type="number" min="0" max="60" value={localOverlapDuration} onChange={e => setLocalOverlapDuration(e.target.value)} className={styles.advInput} />
                    <span className={styles.advUnit}>sec</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                    {[{ label: '15s', val: '15' }, { label: '30s (Default)', val: '30' }, { label: '45s', val: '45' }].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setLocalOverlapDuration(preset.val)}
                        style={{
                          fontSize: '10px',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          border: localOverlapDuration === preset.val ? '1px solid var(--brand-500)' : '1px solid color-mix(in oklab, var(--white) 10%, transparent)',
                          backgroundColor: localOverlapDuration === preset.val ? 'color-mix(in oklab, var(--brand-500) 15%, transparent)' : 'color-mix(in oklab, var(--muted) 40%, transparent)',
                          color: localOverlapDuration === preset.val ? 'var(--brand-400)' : 'var(--muted-foreground)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className={styles.advHint} style={{ marginTop: '0.375rem' }}>Overlap between chunks avoids cutting words mid-sentence.</p>
                </div>
              </div>
              <div className={styles.advFooter}>
                <span className={styles.advSummaryNote}>
                  <Radio className={styles.iconXs} /> Applies to all future transcription jobs.
                </span>
                <button type="button" onClick={resetAdvanced} className={styles.advResetBtn}>
                  <RotateCcw className={styles.iconXs} /> Reset to defaults
                </button>
              </div>
            </details>
          </div>

          {/* Storage Cleanup Section */}
          <div className={styles.advSection} style={{ marginTop: '1rem' }}>
            <div className={styles.advGrid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
              <div>
                <Label className={styles.advLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Trash2 style={{ width: '1rem', height: '1rem', color: 'var(--muted-foreground)' }} /> Storage Cleanup
                </Label>
                <p className={styles.advHint} style={{ margin: 0 }}>
                  Purge unused or orphaned audio files from disk to free up space.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupStorage}
                disabled={cleaningStorage}
                style={{ gap: '0.5rem' }}
              >
                {cleaningStorage ? <Loader2 className={`${styles.iconSm} ${styles.spin}`} /> : <Trash2 className={styles.iconSm} />}
                Clean Storage
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <p className={styles.footerHint}>
            Changes take effect for all future transcription jobs.
          </p>
          <div className={styles.footerBtns}>
            <Button variant="ghost" size="sm" onClick={() => setCurrentView('upload')} className={styles.cancelBtn}>
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
      </div>
    </div>
  );
}
