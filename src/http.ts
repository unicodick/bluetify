export class RequestTimeoutError extends Error {
  constructor(
    public readonly requestLabel: string,
    public readonly timeoutMs: number,
  ) {
    super(`${requestLabel} timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export async function fetchWithTimeout(
  requestLabel: string,
  timeoutMs: number,
  input: string | URL,
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
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
