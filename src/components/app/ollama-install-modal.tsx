'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';

interface OllamaInstallModalProps {
  open: boolean;
  modelId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function OllamaInstallModal({ open, modelId, onClose, onComplete }: OllamaInstallModalProps) {
  const [status, setStatus] = useState<'idle' | 'installing' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || status !== 'idle') return;

    const installModel = async () => {
      setStatus('installing');
      setLogs([]);
      setError(null);
      setProgress(0);

      try {
        const response = await fetch('/api/ollama-pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.status === 'progress') {
                  setLogs(prev => [...prev.slice(-9), data.message]);
                  // Extract percentage from message if available
                  const percentMatch = data.message.match(/(\d+)%/);
                  if (percentMatch) {
                    setProgress(parseInt(percentMatch[1]));
                  }
                } else if (data.status === 'complete') {
                  setProgress(100);
                  setStatus('complete');
                } else if (data.status === 'error') {
                  throw new Error(data.message);
                }
              } catch (e) {
                if (e instanceof Error && !e.message.includes('Unexpected end')) {
                  console.error('Parse error:', e);
                }
              }
            }
          }
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Installation failed');
      }
    };

    installModel();
  }, [open, modelId, status]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Installing Ollama Model</DialogTitle>
          <DialogDescription>
            Downloading and installing {modelId}...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Icon */}
          <div className="flex items-center justify-center">
            {status === 'installing' && (
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            )}
            {status === 'complete' && (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            )}
            {status === 'error' && (
              <XCircle className="w-8 h-8 text-destructive" />
            )}
          </div>

          {/* Progress Bar */}
          {status === 'installing' && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}

          {/* Logs */}
          <div className="max-h-48 overflow-y-auto bg-muted/50 rounded-lg p-3 space-y-1">
            {logs.length === 0 && status === 'installing' && (
              <p className="text-xs text-muted-foreground">Starting installation...</p>
            )}
            {logs.map((log, i) => (
              <p key={i} className="text-xs text-muted-foreground font-mono break-words">
                {log}
              </p>
            ))}
          </div>

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Status Message */}
          {status === 'complete' && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-sm">
              ✓ Model installed successfully! You can now use it for transcription.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {status === 'error' && (
              <>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setStatus('idle');
                    setProgress(0);
                    setLogs([]);
                    setError(null);
                  }}
                  className="gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Retry
                </Button>
              </>
            )}
            {status === 'complete' && (
              <Button
                onClick={() => {
                  onClose();
                  onComplete();
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continue
              </Button>
            )}
            {status === 'installing' && (
              <Button disabled>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                Installing...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
