import { NextRequest, NextResponse } from 'next/server';
import { analyzeThemes } from '@/lib/thematic-analysis/analyzer';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const researchQuestion = (formData.get('researchQuestion') as string) || undefined;

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const transcripts: Array<{ content: string; fileName: string }> = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thematic-'));

    try {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const content = buffer.toString('utf-8');
        transcripts.push({ content, fileName: file.name });
      }

      if (transcripts.length === 0 || transcripts.every(t => !t.content.trim())) {
        return NextResponse.json({ error: 'All files are empty' }, { status: 400 });
      }

      const result = await analyzeThemes(transcripts, researchQuestion);

      return NextResponse.json({
        status: 'complete',
        result,
      });
    } finally {
      try { fs.rmSync(tempDir, { recursive: true }); } catch {}
    }
  } catch (err) {
    console.error('[thematic-analysis] Error:', err);
    return NextResponse.json({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Analysis failed',
    }, { status: 500 });
  }
}
