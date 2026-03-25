export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
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

      const delayMs = options.baseDelayMs * attempt;
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw new Error('operation failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
