/**
 * Utility functions to check Gemini transcription API errors
 * and classify rate limits or geographical restrictions.
 */

export function isQuotaError(err: unknown): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  return (
    errMsg.includes('429') ||
    errMsg.includes('Too Many Requests') ||
    errMsg.includes('quota') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('fetch failed')
  );
}

export function classifyGeminiError(err: unknown): { isLocationError: boolean; isQuotaError: boolean; message: string; suggestion: string } {
  const errMsg = err instanceof Error ? err.message : String(err);

  const isLocation =
    errMsg.includes('User location is not supported') ||
    errMsg.includes('location is not supported for the API use') ||
    errMsg.includes('not available in your country') ||
    (errMsg.includes('REGION') && errMsg.includes('not supported'));

  const isQuota = isQuotaError(err);

  if (isLocation) {
    return {
      isLocationError: true,
      isQuotaError: false,
      message: 'Gemini API is not available in your region.',
      suggestion: 'Set up a proxy URL in Settings if needed.',
    };
  }

  if (isQuota) {
    return {
      isLocationError: false,
      isQuotaError: true,
      message: 'Gemini API quota exceeded (Rate limit 429).',
      suggestion: 'Automatic fallback to Soniox will be attempted if configured.',
    };
  }

  return {
    isLocationError: false,
    isQuotaError: false,
    message: errMsg,
    suggestion: '',
  };
}
