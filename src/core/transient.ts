import {
  NetworkRequestError,
  RequestTimeoutError,
  parseRetryAfter,
} from './http.js';
import { REQUEST_RETRY_MAX_DELAY_MS } from './constants.js';

export function isTransientError(error: unknown): boolean {
  if (error instanceof RequestTimeoutError || error instanceof NetworkRequestError) {
    return true;
  }

  const status = getNumericProperty(error, 'status');
  return (
    status === 1 ||
    status === 429 ||
    (status !== undefined && status >= 500 && status <= 599)
  );
}

export function getRetryDelayMs(
  error: unknown,
  attempt: number,
  baseDelayMs: number,
): number {
  const retryAfterMs = getRetryAfterMs(error);
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, REQUEST_RETRY_MAX_DELAY_MS);
  }

  const exponentialDelay = Math.min(
    baseDelayMs * 2 ** (attempt - 1),
    REQUEST_RETRY_MAX_DELAY_MS,
  );
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.max(1, Math.round(exponentialDelay * jitter));
}

function getRetryAfterMs(error: unknown): number | undefined {
  const direct = getNumericProperty(error, 'retryAfterMs');
  if (direct !== undefined) return direct;

  if (typeof error !== 'object' || error === null || !('headers' in error)) {
    return undefined;
  }
  const headers = error.headers;
  if (headers instanceof Headers) {
    return parseRetryAfter(headers.get('retry-after'));
  }
  if (typeof headers === 'object' && headers !== null) {
    const value = (headers as Record<string, unknown>)['retry-after'];
    return parseRetryAfter(typeof value === 'string' ? value : null);
  }
  return undefined;
}

function getNumericProperty(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'number' && Number.isFinite(property) ? property : undefined;
}
