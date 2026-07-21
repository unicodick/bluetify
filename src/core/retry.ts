export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  getDelayMs?: (error: unknown, attempt: number) => number;
  signal?: AbortSignal;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 1;

  while (attempt <= options.attempts) {
    try {
      return await operation();
    } catch (error) {
      if (!options.shouldRetry(error, attempt) || attempt === options.attempts) {
        throw error;
      }

      const delayMs = options.getDelayMs?.(error, attempt) ?? options.baseDelayMs * attempt;
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs, options.signal);
      attempt += 1;
    }
  }

  throw new Error('operation failed after retries');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timeoutId);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
