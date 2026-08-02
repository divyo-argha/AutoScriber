import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    let settings = await db.appSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await db.appSettings.create({ data: { id: 'default' } });
    }
    return NextResponse.json({
      ...settings,
      geminiApiKey: process.env.GEMINI_API_KEY ? '***' : '',
      userGeminiApiKey: settings.geminiApiKey || '',
      userSonioxApiKey: (settings as any).sonioxApiKey || '',
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await db.appSettings.upsert({
      where: { id: 'default' },
      update: {
        defaultModel: body.defaultModel,
        chunkDuration: body.chunkDuration,
        overlapDuration: body.overlapDuration,
        geminiApiKey: body.userGeminiApiKey || '',
        ...(body.userSonioxApiKey !== undefined && { sonioxApiKey: body.userSonioxApiKey }),
      } as any,
      create: {
        id: 'default',
        defaultModel: body.defaultModel || 'gemini-2.5-flash',
        chunkDuration: body.chunkDuration || 300,
        overlapDuration: body.overlapDuration || 30,
        geminiApiKey: body.userGeminiApiKey || '',
        sonioxApiKey: body.userSonioxApiKey || '',
      } as any,
    });
    return NextResponse.json(settings);
  } catch (err) {
    console.error('Error saving settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
