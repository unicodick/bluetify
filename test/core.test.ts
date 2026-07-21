import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HttpResponseError,
  RequestTimeoutError,
  isTransientError,
  retry,
  truncateBlueskyDescription,
} from '../src/core/index.js';

test('truncates descriptions by grapheme without splitting emoji', () => {
  const result = truncateBlueskyDescription('😀'.repeat(300));
  assert.equal(Array.from(result).length, 256);
  assert.equal(result.includes('�'), false);
});

test('enforces the encoded byte limit at grapheme boundaries', () => {
  const family = '👨‍👩‍👧‍👦';
  const result = truncateBlueskyDescription(family.repeat(300));
  assert.ok(Buffer.byteLength(result, 'utf8') <= 2560);
  assert.equal(result.replaceAll(family, ''), '');
});

test('classifies retryable failures', () => {
  assert.equal(isTransientError(new RequestTimeoutError('test', 100)), true);
  assert.equal(isTransientError(new HttpResponseError('rate limited', 429, 1000)), true);
  assert.equal(isTransientError({ status: 503 }), true);
  assert.equal(isTransientError({ status: 400 }), false);
  assert.equal(isTransientError({ retryable: true }), true);
});

test('retries an operation with a configurable delay', async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls += 1;
      if (calls < 3) throw new RequestTimeoutError('test', 100);
      return 'ok';
    },
    {
      attempts: 3,
      baseDelayMs: 1,
      shouldRetry: isTransientError,
      getDelayMs: () => 0,
    },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('cancels retry backoff', async () => {
  const controller = new AbortController();
  await assert.rejects(
    retry(
      async () => {
        throw new RequestTimeoutError('test', 100);
      },
      {
        attempts: 3,
        baseDelayMs: 1000,
        shouldRetry: isTransientError,
        signal: controller.signal,
        onRetry: () => controller.abort(),
      },
    ),
    { name: 'AbortError' },
  );
});
