/**
 * Shared transient-error detection and retry-with-backoff for the Gemini and
 * Vertex providers. Both previously maintained near-identical copies of this
 * logic; this module is the single source of truth.
 */
import { isQuotaError } from './error-utils';

/**
 * Returns true when an error is safe to retry: rate limits (429/quota),
 * transient server errors (5xx), or network failures.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const errMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (
    isQuotaError(err) ||
    errMsg.includes('429') ||
    errMsg.includes('too many requests') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted')
  ) {
    return true;
  }

  if (
    errMsg.includes('500') ||
    errMsg.includes('502') ||
    errMsg.includes('503') ||
    errMsg.includes('504') ||
    errMsg.includes('internal error') ||
    errMsg.includes('bad gateway') ||
    errMsg.includes('service unavailable') ||
    errMsg.includes('overloaded')
  ) {
    return true;
  }

  if (
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('socket hang up') ||
    errMsg.includes('network') ||
    errMsg.includes('und_err') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('aborted') ||
    errMsg.includes('failed to fetch')
  ) {
    return true;
  }

  return false;
}

/**
 * A "limit: 0" quota means this model is permanently unavailable for the
 * current credentials. Retrying is pointless — callers should fall back.
 */
export function isHardQuotaError(err: unknown): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  return errMsg.includes('limit: 0') || errMsg.includes('per_day') || errMsg.includes('per-day');
}

export interface RetryOptions {
  modelId?: string;
  maxRetries?: number;
  initialDelayMs?: number;
  /** Minimum wait (ms) for rate-limit errors before retrying. */
  minQuotaDelayMs?: number;
  /** Enable model-aware pacing (Flash ~3s, Pro ~30s) between requests. */
  enablePacing?: boolean;
  /** Log prefix, e.g. '[gemini]' or '[vertex]'. */
  logPrefix?: string;
}

// Module-level pacing state shared by every provider call.
let lastRequestTimestamp = 0;

async function enforceRateLimitPacing(modelId: string): Promise<void> {
  const isProModel = modelId.toLowerCase().includes('pro');
  const minDelayMs = isProModel ? 30000 : 3000;

  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (lastRequestTimestamp > 0 && elapsed < minDelayMs) {
    const waitTime = minDelayMs - elapsed;
    console.log(`[pacing] (${modelId}): waiting ${Math.round(waitTime / 1000)}s before next request...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTimestamp = Date.now();
}

/**
 * Wraps a single generateContent call with exponential backoff on transient
 * errors, honoring server-provided retry delays when present.
 */
export async function withTransientRetry<T>(
  call: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    modelId = 'gemini-2.0-flash',
    maxRetries = 2,
    initialDelayMs = 2000,
    minQuotaDelayMs = 4000,
    enablePacing = false,
    logPrefix = '[api]',
  } = options;

  if (enablePacing) {
    await enforceRateLimitPacing(modelId);
  }

  let attempt = 0;
  while (true) {
    try {
      return await call();
    } catch (err: any) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransient = isTransientError(err);

      if (isTransient && !isHardQuotaError(err) && attempt <= maxRetries) {
        let delayMs = initialDelayMs * Math.pow(2, attempt - 1);

        const retryDelayMatch = errMsg.match(/retryDelay["\s:]+(\d+)s/i) || errMsg.match(/retry in ([\d.]+)\s*s/i);
        if (retryDelayMatch && retryDelayMatch[1]) {
          const seconds = parseFloat(retryDelayMatch[1]);
          if (!isNaN(seconds) && seconds > 0) {
            delayMs = (seconds + 1) * 1000;
          }
        } else if (err?.status === 429 && err?.headers?.get?.('retry-after')) {
          const retryAfter = parseInt(err.headers.get('retry-after'), 10);
          if (!isNaN(retryAfter) && retryAfter > 0) {
            delayMs = (retryAfter + 1) * 1000;
          }
        } else if (isQuotaError(err) || errMsg.includes('429')) {
          delayMs = Math.max(delayMs, minQuotaDelayMs);
        }

        const jitter = Math.floor(Math.random() * 800);
        delayMs += jitter;

        console.warn(`${logPrefix} Transient/Network error (${errMsg.substring(0, 80)}). Retrying attempt ${attempt}/${maxRetries} after ${Math.round(delayMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
}
