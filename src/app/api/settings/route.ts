import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGcpCredentialsInfo, saveGcpCredentialsJson } from '@/lib/transcriber/gcp-credentials';

export async function GET() {
  try {
    let settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await db.appSettings.create({ data: { id: 'default' } });
    }

    const gcpCredsInfo = getGcpCredentialsInfo(settings.gcpCredentialsPath, settings.gcpLocation);

    return NextResponse.json({
      ...settings,
      geminiApiKey: process.env.GEMINI_API_KEY ? '***' : '',
      userGeminiApiKey: settings.geminiApiKey || '',
      gcpCredentialsStatus: gcpCredsInfo,
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const isNum = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);

    let customPath = body.gcpCredentialsPath || '';

    // If user provided raw JSON credentials string
    if (body.gcpCredentialsJson && typeof body.gcpCredentialsJson === 'string' && body.gcpCredentialsJson.trim().length > 0) {
      const saveResult = saveGcpCredentialsJson(body.gcpCredentialsJson);
      if (saveResult.success) {
        customPath = saveResult.filePath;
      } else {
        return NextResponse.json({ error: saveResult.error }, { status: 400 });
      }
    }

    const settings = await db.appSettings.upsert({
      where: { id: 'default' },
      update: {
        aiProvider: body.aiProvider || 'auto',
        defaultModel: body.defaultModel,
        chunkDuration: isNum(body.chunkDuration) ? body.chunkDuration : 300,
        overlapDuration: isNum(body.overlapDuration) ? body.overlapDuration : 30,
        geminiApiKey: body.userGeminiApiKey !== undefined ? body.userGeminiApiKey : undefined,
        gcpProjectId: body.gcpProjectId || '',
        gcpLocation: body.gcpLocation || 'us-central1',
        gcpCredentialsPath: customPath,
      } as any,
      create: {
        id: 'default',
        aiProvider: body.aiProvider || 'auto',
        defaultModel: body.defaultModel || 'gemini-2.0-flash',
        chunkDuration: isNum(body.chunkDuration) ? body.chunkDuration : 300,
        overlapDuration: isNum(body.overlapDuration) ? body.overlapDuration : 30,
        geminiApiKey: body.userGeminiApiKey || '',
        gcpProjectId: body.gcpProjectId || '',
        gcpLocation: body.gcpLocation || 'us-central1',
        gcpCredentialsPath: customPath,
      } as any,
    });

    const gcpCredsInfo = getGcpCredentialsInfo(settings.gcpCredentialsPath, settings.gcpLocation);

    return NextResponse.json({
      ...settings,
      gcpCredentialsStatus: gcpCredsInfo,
    });
  } catch (err) {
    console.error('Error saving settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
