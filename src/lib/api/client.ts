/**
 * Minimal typed fetch wrapper. All API routes return JSON, so we parse once
 * and surface a typed error on non-2xx responses.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorType?: string;

  constructor(message: string, status: number, errorType?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorType = errorType;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown | FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, signal } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(path, {
    method,
    signal,
    headers: isFormData
      ? { ...(headers || {}) }
      : { 'Content-Type': 'application/json', ...(headers || {}) },
    body: isFormData
      ? (body as FormData)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const payload = (data && typeof data === 'object') ? (data as { error?: unknown; errorType?: unknown }) : {};
    const message = typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`;
    const errorType = typeof payload.errorType === 'string' ? payload.errorType : undefined;
    throw new ApiError(message, res.status, errorType);
  }

  return data as T;
}
