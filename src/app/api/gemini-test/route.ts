import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('model') || 'gemini-2.0-flash';
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

    const modelsToTry = [
      modelId,
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
    ].filter((value, index, self) => self.indexOf(value) === index);

    const attempts: { model: string; success: boolean; error?: string }[] = [];
    const disabledModels: Record<string, string> = {};
    let workingModel = '';
    let text = '';

    for (const currentModel of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: currentModel });
        const result = await model.generateContent('Respond with only the word "OK".');
        text = result.response.text();
        if (!workingModel) workingModel = currentModel;
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        attempts.push({ model: currentModel, success: false, error: errMsg });
        
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('limit: 0')) {
          disabledModels[currentModel] = 'Free tier rate limit / quota exhausted';
        }

        // Auth failures should stop the loop immediately
        const isAuthError =
          errMsg.includes('API key not valid') ||
          errMsg.includes('invalid API key') ||
          errMsg.includes('401');
      }
    }

    if (workingModel) {
      return NextResponse.json({
        connected: true,
        response: text.substring(0, 100),
        workingModel,
        fallbackUsed: workingModel !== modelId,
        disabledModels,
      });
    }

    // All models failed - aggregate errors and determine overall type
    const errorDetails = attempts.map(a => `${a.model}: ${a.error}`).join(' | ');
    const hasAuthError = attempts.some(a => a.error?.includes('API key not valid') || a.error?.includes('invalid API key') || a.error?.includes('401') || a.error?.includes('403'));
    const hasLocationError = attempts.some(a => a.error?.includes('location is not supported') || a.error?.includes('location is not supported for the API use'));
    const hasQuotaError = attempts.some(a => a.error?.includes('quota') || a.error?.includes('429') || a.error?.includes('rate limit'));

    let errorType = 'unknown';
    let error = 'Unable to connect to the Gemini API. Please try again later.';
    let suggestion = '';

    if (hasAuthError) {
      errorType = 'auth_failed';
      error = 'Your Gemini API key is invalid or has been revoked. Please check the key in Settings.';
      suggestion = 'Generate a new key at aistudio.google.com and paste it in Settings.';
    } else if (hasLocationError) {
      errorType = 'location_blocked';
      error = 'Gemini API is not available in your region.';
      suggestion = 'Set up a proxy URL in Settings if needed.';
    } else if (hasQuotaError) {
      errorType = 'quota_exceeded';
      error = 'Gemini API rate limit (429) exceeded for your account.';
      suggestion = 'Free tier quota exhausted. Either wait for the daily reset (midnight Pacific Time), or upgrade to a paid plan at aistudio.google.com. Note: keys from GCP Cloud Console do NOT get free-tier quota — use Google AI Studio to generate your key instead.';
    } else {
      errorType = 'model_not_found';
      error = 'The selected Gemini models are not available for your account.';
      suggestion = 'Try a different model, or generate a new API key at aistudio.google.com.';
    }

    // Raw provider details are logged server-side only — never sent to the UI.
    console.error('[gemini-test] Connection failed. Raw error details:', errorDetails);

    return NextResponse.json({
      connected: false,
      error,
      errorType,
      suggestion,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[gemini-test] Unexpected error (raw):', errMsg);
    return NextResponse.json({
      connected: false,
      error: 'Unable to connect to the Gemini API. Please try again later.',
      errorType: 'unknown',
      suggestion: 'An unexpected connection error occurred.',
    });
  }
}
