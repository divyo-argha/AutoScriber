'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { AVAILABLE_MODELS, VERTEX_MODELS } from '@/lib/transcriber/types';
import { validateGcpCredentialsJson } from '@/lib/transcriber/credentials-validate';
import {
  fetchSettings,
  saveSettings,
  testGeminiConnection,
  testVertexConnection,
  cleanupAudioStorage,
} from '@/lib/api';

export type TestStatus = 'idle' | 'testing' | 'connected' | 'error';

export interface GcpStatus {
  exists: boolean;
  filePath: string | null;
  projectId: string | null;
  clientEmail: string | null;
  location: string;
  source: string;
  error?: string;
}

export type CredentialsValidation = ReturnType<typeof validateGcpCredentialsJson>;

export interface VertexSuccess {
  projectId: string;
  location: string;
  model: string;
}

export function useSettingsForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { chunkDuration, overlapDuration, userGeminiApiKey, selectedModel, setSelectedModel, setDisabledModel, setSettings } = useAppStore();

  const [mainSectionTab, setMainSectionTab] = useState<'config' | 'advanced'>('config');
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
  const [vertexSuccess, setVertexSuccess] = useState<VertexSuccess | null>(null);
  const [saving, setSaving] = useState(false);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleCleanupStorage = useCallback(async () => {
    setCleaningStorage(true);
    try {
      const data = await cleanupAudioStorage();
      toast({
        title: 'Storage Cleaned',
        description: `Removed ${data.filesDeleted} orphan audio files (${data.formattedFreed || '0 MB'} freed).`,
      });
    } catch (err) {
      toast({
        title: 'Cleanup Error',
        description: err instanceof Error ? err.message : 'Storage cleanup failed',
        variant: 'destructive',
      });
    } finally {
      setCleaningStorage(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data.gcpProjectId) setGcpProjectId(data.gcpProjectId);
        if (data.gcpLocation) setGcpLocation(data.gcpLocation);
        if (data.gcpCredentialsPath) setGcpCredentialsPath(data.gcpCredentialsPath);
        if (data.gcpCredentialsStatus) setGcpStatus(data.gcpCredentialsStatus as GcpStatus);
        if (data.gcpCredentialsStatus?.projectId && !data.gcpProjectId) {
          setGcpProjectId(data.gcpCredentialsStatus.projectId);
        }
        if (data.userGeminiApiKey) {
          setLocalGeminiKey(data.userGeminiApiKey);
          setSettings({ userGeminiApiKey: data.userGeminiApiKey, hasVertexKey: !!data.gcpCredentialsStatus?.exists });
        } else {
          setSettings({ hasVertexKey: !!data.gcpCredentialsStatus?.exists });
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

  const selectVertexModel = useCallback((modelId: string) => {
    setSelectedVertexModel(modelId);
    setSelectedModel(modelId);
  }, [setSelectedModel]);

  const selectGeminiModel = useCallback((modelId: string) => {
    setSelectedGeminiModel(modelId);
    setSelectedModel(modelId);
  }, [setSelectedModel]);

  const testGemini = useCallback(async () => {
    setGeminiStatus('testing');
    setGeminiError('');
    setGeminiSuccessModel('');
    try {
      const data = await testGeminiConnection(selectedGeminiModel || 'gemini-2.0-flash', localGeminiKey || undefined);
      if (data.connected) {
        setGeminiStatus('connected');
        setGeminiSuccessModel(data.workingModel || '');
        if (data.disabledModels && typeof data.disabledModels === 'object') {
          Object.entries(data.disabledModels).forEach(([mId, reason]) => {
            setDisabledModel(mId, reason as string);
          });
        }
        if (data.fallbackUsed && data.workingModel) {
          toast({
            title: '⚡ Gemini AI Connected',
            description: `Model automatically optimized to ${data.workingModel}. Rate-limited models disabled in dropdown.`,
          });
        } else {
          toast({
            title: '✨ Gemini AI Connected',
            description: 'Google AI Studio key verification successful!',
          });
        }
      } else {
        const errMsg = data.error || data.suggestion || 'Connection failed';
        const suggestionMsg = data.suggestion && data.error ? ` ${data.suggestion}` : '';
        setGeminiStatus('error');
        setGeminiError(errMsg);
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: `${errMsg}${suggestionMsg}`,
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
  }, [selectedGeminiModel, localGeminiKey, setDisabledModel, toast]);

  const testVertex = useCallback(async () => {
    setVertexStatus('testing');
    setVertexError('');
    setVertexSuccess(null);
    try {
      const data = await testVertexConnection({
        gcpProjectId,
        gcpLocation,
        gcpCredentialsPath,
        gcpCredentialsJson: gcpCredentialsJson.trim() || undefined,
        modelId: selectedVertexModel,
      });
      if (data.success) {
        setVertexStatus('connected');
        setVertexSuccess({
          projectId: data.projectId || '',
          location: data.location || '',
          model: data.model || '',
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
    } catch {
      setVertexStatus('error');
      setVertexError('Network error communicating with the Vertex AI API.');
      toast({
        variant: 'destructive',
        title: 'Vertex AI Connection Failed',
        description: 'Network error communicating with Vertex API.',
      });
    }
  }, [gcpProjectId, gcpLocation, gcpCredentialsPath, gcpCredentialsJson, selectedVertexModel, toast]);

  const resetAdvanced = useCallback(() => {
    setLocalChunkDuration('300');
    setLocalOverlapDuration('30');
  }, []);

  const saveSettingsHandler = useCallback(async () => {
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
        gcpCredentialsJson: gcpCredentialsJson.trim(),
      };

      setSettings({
        chunkDuration: body.chunkDuration,
        overlapDuration: body.overlapDuration,
        userGeminiApiKey: localGeminiKey,
        hasVertexKey: !!(projectIdFromJson || gcpProjectId || (jsonValidation && jsonValidation.valid) || (body.gcpCredentialsJson && body.gcpCredentialsJson.trim().length > 0)),
      });

      const data = await saveSettings(body);

      if (data.gcpCredentialsStatus) {
        setGcpStatus(data.gcpCredentialsStatus as GcpStatus);
      }

      toast({
        title: '✨ Settings Saved',
        description: 'Your AI engine & GCP credentials configuration are up to date.',
      });

      router.push('/app');
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
  }, [localChunkDuration, localOverlapDuration, jsonValidation, activeTab, localGeminiKey, selectedVertexModel, selectedGeminiModel, gcpProjectId, gcpLocation, gcpCredentialsPath, gcpCredentialsJson, setSettings, toast, router]);

  const activeModelInfo = activeTab === 'vertex'
    ? VERTEX_MODELS.find(m => m.id === selectedVertexModel)
    : AVAILABLE_MODELS.find(m => m.id === selectedGeminiModel);

  return {
    mainSectionTab, setMainSectionTab,
    activeTab, setActiveTab,
    localGeminiKey, setLocalGeminiKey,
    gcpProjectId, setGcpProjectId,
    gcpLocation, setGcpLocation,
    gcpCredentialsPath, setGcpCredentialsPath,
    gcpCredentialsJson, setGcpCredentialsJson,
    gcpStatus, jsonValidation,
    selectedVertexModel, selectedGeminiModel,
    selectVertexModel, selectGeminiModel,
    localChunkDuration, setLocalChunkDuration,
    localOverlapDuration, setLocalOverlapDuration,
    geminiStatus, geminiError, geminiSuccessModel,
    vertexStatus, vertexError, vertexSuccess,
    saving, cleaningStorage, showApiKey, setShowApiKey,
    handleCleanupStorage,
    testGemini, testVertex,
    resetAdvanced,
    saveSettings: saveSettingsHandler,
    activeModelInfo,
  };
}
