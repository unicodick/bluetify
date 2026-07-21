export class RequestTimeoutError extends Error {
  constructor(
    public readonly requestLabel: string,
    public readonly timeoutMs: number,
  ) {
    super(`${requestLabel} timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

export class NetworkRequestError extends Error {
  constructor(
    public readonly requestLabel: string,
    options?: ErrorOptions,
  ) {
    super(`${requestLabel} failed due to a network error`, options);
    this.name = 'NetworkRequestError';
  }
}

export class HttpResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpResponseError';
  }
}

export function parseJsonOrNull<T>(rawBody: string): T | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

export async function fetchWithTimeout(
  requestLabel: string,
  timeoutMs: number,
  input: Parameters<typeof fetch>[0],
  init: RequestInit = {},
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (isAbortError(error) && timeoutController.signal.aborted) {
      throw new RequestTimeoutError(requestLabel, timeoutMs);
    }
    if (error instanceof TypeError) {
      throw new NetworkRequestError(requestLabel, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return undefined;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}
