import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('model') || 'gemini-2.5-flash';
  const apiKeyFromQuery = searchParams.get('apiKey')?.trim() || undefined;

  const settings = await db.appSettings.findUnique({ where: { id: 'default' } });
  const apiKey = apiKeyFromQuery || settings?.geminiApiKey || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      error: 'Gemini API key is not configured',
      errorType: 'no_key',
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent('Respond with only the word "OK".');
    const text = result.response.text();

    return NextResponse.json({
      connected: true,
      response: text.substring(0, 100),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Classify the error
    const isLocationError =
      errMsg.includes('User location is not supported') ||
      errMsg.includes('location is not supported for the API use');

    const isAuthError =
      errMsg.includes('API key not valid') ||
      errMsg.includes('invalid API key') ||
      errMsg.includes('401') ||
      errMsg.includes('403');

    const isQuotaError =
      errMsg.includes('quota') ||
      errMsg.includes('429') ||
      errMsg.includes('rate limit');

    let errorType = 'unknown';
    let suggestion = '';

    if (isLocationError) {
      errorType = 'location_blocked';
      suggestion = 'Gemini API is not available in your region. Set up a proxy URL in Settings if needed.';
    } else if (isAuthError) {
      errorType = 'auth_failed';
      suggestion = 'Your API key appears to be invalid. Please check your Gemini API key in Settings.';
    } else if (isQuotaError) {
      errorType = 'quota_exceeded';
      suggestion = 'API quota exceeded. Please check your Google AI Studio usage limits.';
    }

    return NextResponse.json({
      connected: false,
      error: errMsg,
      errorType,
      suggestion,
    });
  }
}
