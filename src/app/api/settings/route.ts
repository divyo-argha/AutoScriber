import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGcpCredentialsInfo, getGcpCredentialsInfoFromJson, validateGcpCredentialsJson } from '@/lib/transcriber/gcp-credentials';

export async function GET() {
  try {
    let settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await db.appSettings.create({ data: { id: 'default' } });
    }

    // Credentials stored in the DB take precedence; otherwise detect a key file
    // in the project root / env var (standard Google tooling).
    const gcpCredsInfo = settings.gcpCredentialsJson
      ? getGcpCredentialsInfoFromJson(settings.gcpCredentialsJson, settings.gcpLocation)
      : getGcpCredentialsInfo(settings.gcpCredentialsPath, settings.gcpLocation);

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

    const newJson = typeof body.gcpCredentialsJson === 'string' ? body.gcpCredentialsJson.trim() : '';
    if (newJson) {
      const validation = validateGcpCredentialsJson(newJson);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
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
        ...(newJson ? { gcpCredentialsJson: newJson } : {}),
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
        gcpCredentialsJson: newJson,
      } as any,
    });

    const gcpCredsInfo = settings.gcpCredentialsJson
      ? getGcpCredentialsInfoFromJson(settings.gcpCredentialsJson, settings.gcpLocation)
      : getGcpCredentialsInfo(settings.gcpCredentialsPath, settings.gcpLocation);

    return NextResponse.json({
      ...settings,
      gcpCredentialsStatus: gcpCredsInfo,
    });
  } catch (err) {
    console.error('Error saving settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
