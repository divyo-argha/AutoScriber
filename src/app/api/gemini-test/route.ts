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
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
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

        if (isAuthError) {
          break;
        }
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
    let suggestion = '';

    if (hasAuthError) {
      errorType = 'auth_failed';
      suggestion = 'Your API key appears to be invalid. Please check your Gemini API key in Settings.';
    } else if (hasLocationError) {
      errorType = 'location_blocked';
      suggestion = 'Gemini API is not available in your region. Set up a proxy URL in Settings if needed.';
    } else if (hasQuotaError) {
      errorType = 'quota_exceeded';
      suggestion = 'Free tier quota exhausted. Either wait for the daily reset (midnight Pacific Time), or upgrade to a paid plan at aistudio.google.com. Note: keys from GCP Cloud Console do NOT get free-tier quota — use Google AI Studio to generate your key instead.';
    } else {
      errorType = 'model_not_found';
      suggestion = 'The requested models were not found or not supported on this account.';
    }

    return NextResponse.json({
      connected: false,
      error: errorDetails,
      errorType,
      suggestion,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      connected: false,
      error: errMsg,
      errorType: 'unknown',
      suggestion: 'An unexpected connection error occurred.',
    });
  }
}
