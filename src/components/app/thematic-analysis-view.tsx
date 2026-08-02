'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, X, Play, Loader2, Download, ChevronDown, ChevronRight, AlertCircle, Edit2, Trash2, Check } from 'lucide-react';
import type { ThematicAnalysisResult, Code, Theme } from '@/lib/thematic-analysis/types';
import { useToast } from '@/hooks/use-toast';

export function ThematicAnalysisView() {
  const [files, setFiles] = useState<File[]>([]);
  const [researchQuestion, setResearchQuestion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [result, setResult] = useState<ThematicAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const showError = (msg: string) => {
    setError(msg);
    toast({
      variant: 'destructive',
      title: 'Thematic Analysis Error',
      description: msg,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (files.length === 0) {
      showError('Please upload at least one transcript file');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setAnalysisStatus('Reading transcripts...');

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      if (researchQuestion.trim()) {
        formData.append('researchQuestion', researchQuestion);
      }

      setAnalysisStatus('Analyzing themes and patterns...');
      const res = await fetch('/api/thematic-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysisStatus('Organizing results...');
      setResult(data.result);
      setAnalysisStatus('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalysisStatus('');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleTheme = (themeId: string) => {
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  };

  const updateCode = (codeId: string, updates: Partial<Code>) => {
    if (!result) return;
    setResult({
      ...result,
      codes: result.codes.map(c => c.id === codeId ? { ...c, ...updates } : c),
    });
    setEditingCodeId(null);
  };

  const updateTheme = (themeId: string, updates: Partial<Theme>) => {
    if (!result) return;
    setResult({
      ...result,
      themes: result.themes.map(t => t.id === themeId ? { ...t, ...updates } : t),
    });
    setEditingThemeId(null);
  };

  const deleteCode = (codeId: string) => {
    if (!result) return;
    setResult({
      ...result,
      codes: result.codes.filter(c => c.id !== codeId),
      themes: result.themes.map(t => ({
        ...t,
        codes: t.codes.filter(id => id !== codeId),
      })),
    });
  };

  const deleteTheme = (themeId: string) => {
    if (!result) return;
    setResult({
      ...result,
      themes: result.themes.filter(t => t.id !== themeId),
    });
  };

  const exportResults = (format: 'json' | 'csv') => {
    if (!result) return;

    let content = '';
    let filename = '';

    if (format === 'json') {
      content = JSON.stringify(result, null, 2);
      filename = 'thematic-analysis.json';
    } else {
      const rows = [['Theme', 'Code', 'Quote', 'Source']];
      result.themes.forEach(theme => {
        const codes = result.codes.filter(c => theme.codes.includes(c.id));
        codes.forEach(code => {
          code.quotes.forEach(quote => {
            rows.push([theme.name, code.label, quote.text, quote.source]);
          });
        });
      });
      content = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      filename = 'thematic-analysis.csv';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (result) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Thematic Analysis Results</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {result.themes.length} themes · {result.codes.length} codes · {files.length} transcript{files.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportResults('json')} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportResults('csv')} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setFiles([]); }}>
              New Analysis
            </Button>
          </div>
        </div>

        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">{result.summary}</p>
        </Card>

        <div className="space-y-3">
          {result.themes.map(theme => {
            const themeCodes = result.codes.filter(c => theme.codes.includes(c.id));
            const isExpanded = expandedThemes.has(theme.id);

            return (
              <Card key={theme.id} className="overflow-hidden">
                <div
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleTheme(theme.id)} className="shrink-0 mt-0.5">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingThemeId === theme.id ? (
                          <Input
                            defaultValue={theme.name}
                            onBlur={(e) => updateTheme(theme.id, { name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateTheme(theme.id, { name: e.currentTarget.value });
                              if (e.key === 'Escape') setEditingThemeId(null);
                            }}
                            autoFocus
                            className="h-7 max-w-xs"
                          />
                        ) : (
                          <h3 className="font-semibold">{theme.name}</h3>
                        )}
                        <Badge variant="outline" className="text-xs">{theme.prevalence}% prevalence</Badge>
                        <Badge variant="secondary" className="text-xs">{themeCodes.length} codes</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{theme.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditingThemeId(theme.id); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this theme?')) deleteTheme(theme.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 space-y-3">
                    {themeCodes.map(code => (
                      <div key={code.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {editingCodeId === code.id ? (
                            <Input
                              defaultValue={code.label}
                              onBlur={(e) => updateCode(code.id, { label: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateCode(code.id, { label: e.currentTarget.value });
                                if (e.key === 'Escape') setEditingCodeId(null);
                              }}
                              autoFocus
                              className="h-7 max-w-xs"
                            />
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                              {code.label}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">({code.frequency} occurrences)</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingCodeId(code.id)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Delete this code?')) deleteCode(code.id); }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{code.description}</p>
                        <div className="space-y-1.5">
                          {code.quotes.map((quote, i) => (
                            <div key={i} className="p-2 rounded-lg bg-background border text-sm">
                              <p className="italic">"{quote.text}"</p>
                              <p className="text-xs text-muted-foreground mt-1">— {quote.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-900 dark:text-amber-100">
            ⚠️ <strong>Disclaimer:</strong> This is AI-assisted thematic analysis. Results require researcher validation and interpretation. 
            Use this as a starting point for your analysis, not as a final output.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Thematic Analysis</h2>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Upload interview transcripts for AI-assisted thematic coding. Follows Braun & Clarke methodology for semi-structured interviews.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="research-question">Research Question (Optional)</Label>
          <Input
            id="research-question"
            placeholder="e.g., How do users experience accessibility features in mobile apps?"
            value={researchQuestion}
            onChange={(e) => setResearchQuestion(e.target.value)}
            disabled={analyzing}
          />
          <p className="text-xs text-muted-foreground">Helps focus the analysis on specific aspects</p>
        </div>

        <div className="space-y-2">
          <Label>Upload Transcripts</Label>
          <Card className="border-2 border-dashed p-6 text-center space-y-3">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drop transcript files here</p>
              <p className="text-xs text-muted-foreground mt-1">TXT, MD, or any text format</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
              <Upload className="w-4 h-4 mr-1.5" /> Choose Files
            </Button>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.text" multiple onChange={handleFileSelect} className="hidden" />
          </Card>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label>{files.length} file{files.length !== 1 ? 's' : ''} selected</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <button onClick={() => removeFile(i)} disabled={analyzing} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={startAnalysis}
                className="mt-2 h-7 text-xs border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                Retry Analysis
              </Button>
            </div>
          </div>
        )}

        <Button
          onClick={startAnalysis}
          disabled={analyzing || files.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              {analysisStatus || 'Analyzing...'}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1.5" />
              Start Analysis
            </>
          )}
        </Button>
      </Card>

      <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-900 dark:text-blue-100">
          <strong>How it works:</strong> The AI reads your transcripts, identifies meaningful patterns (codes), 
          and groups them into themes. Results are transparent and editable. Export to CSV/JSON for further analysis in NVivo or MAXQDA.
        </p>
      </Card>
    </div>
  );
}
