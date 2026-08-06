/**
 * Utility functions to check Gemini transcription API errors
 * and classify rate limits or geographical restrictions.
 *
 * Frontend rule: raw provider error strings must NEVER reach the UI. They are
 * logged server-side, and only the standardized `message` is stored/returned.
 */

export function isQuotaError(err: unknown): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  return (
    errMsg.includes('429') ||
    errMsg.includes('Too Many Requests') ||
    errMsg.includes('quota') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('resource_exhausted')
  );
}

export type GeminiErrorCategory =
  | 'quota'
  | 'auth'
  | 'model_not_found'
  | 'location'
  | 'network'
  | 'generic';

export interface ClassifiedGeminiError {
  type: GeminiErrorCategory;
  isLocationError: boolean;
  isQuotaError: boolean;
  /** Standardized, user-facing message. Safe to show in the UI. */
  message: string;
  /** Optional extra guidance appended to `message` when useful. */
  suggestion: string;
  /** The raw provider error text. For backend logging only — never send to the UI. */
  raw: string;
}

function rawText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Maps a raw Gemini/Google API error to a standardized, user-facing message.
 * The `raw` field is exposed for backend logging only.
 */
export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const errMsg = rawText(err);
  const lower = errMsg.toLowerCase();

  const isLocation =
    lower.includes('user location is not supported') ||
    lower.includes('location is not supported for the api use') ||
    lower.includes('not available in your country') ||
    (lower.includes('region') && lower.includes('not supported'));

  const isAuth =
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission denied') ||
    lower.includes('401') ||
    lower.includes('403');

  const isModelNotFound =
    lower.includes('404') ||
    lower.includes('is not found for api version') ||
    lower.includes('not supported for generatecontent') ||
    lower.includes('no longer available to new users') ||
    lower.includes('not available to new users') ||
    (lower.includes('models/') && lower.includes('not found'));

  const isNetwork =
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('enetunreach') ||
    lower.includes('econnrefused') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('fetch failed');

  const isQuota = isQuotaError(err);

  if (isLocation) {
    return {
      type: 'location',
      isLocationError: true,
      isQuotaError: false,
      message: 'Gemini API is not available in your region.',
      suggestion: 'Set up a proxy URL in Settings if needed.',
      raw: errMsg,
    };
  }

  if (isQuota) {
    return {
      type: 'quota',
      isLocationError: false,
      isQuotaError: true,
      message:
        'Gemini API rate limit (429) exceeded. Please wait a few minutes and try again, or switch to a different model.',
      suggestion: 'Automatic fallback to Soniox will be attempted if configured.',
      raw: errMsg,
    };
  }

  if (isAuth) {
    return {
      type: 'auth',
      isLocationError: false,
      isQuotaError: false,
      message: 'Your Gemini API key is invalid or has been revoked. Check the key in Settings.',
      suggestion: '',
      raw: errMsg,
    };
  }

  if (isModelNotFound) {
    return {
      type: 'model_not_found',
      isLocationError: false,
      isQuotaError: false,
      message:
        'The selected Gemini model is not available for your API key or plan. Please switch to a different model.',
      suggestion: '',
      raw: errMsg,
    };
  }

  if (isNetwork) {
    return {
      type: 'network',
      isLocationError: false,
      isQuotaError: false,
      message: 'Network error while reaching the Gemini API. Check your internet connection and try again.',
      suggestion: '',
      raw: errMsg,
    };
  }

  return {
    type: 'generic',
    isLocationError: false,
    isQuotaError: false,
    message: 'Transcription failed. Please try again.',
    suggestion: '',
    raw: errMsg,
  };
}
