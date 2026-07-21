import assert from 'node:assert/strict';
import test from 'node:test';
import { Config } from '../src/config/index.js';
import { isTransientError } from '../src/core/index.js';
import { getNowPlaying } from '../src/integrations/lastfm/index.js';

const config: Config = {
  bluesky: {
    username: 'alice.test',
    password: 'app-password',
    serviceUrl: 'https://bsky.social',
  },
  lastfm: { apiKey: 'key', username: 'alice' },
  stateFile: '.state.json',
  updateIntervalMs: 30_000,
};

test('maps a validated now-playing response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({
    recenttracks: {
      track: [{
        name: 'Song',
        artist: { '#text': 'Artist' },
        '@attr': { nowplaying: 'true' },
      }],
    },
  }));

  assert.deepEqual(await getNowPlaying(config), { name: 'Song', artist: 'Artist' });
});

test('rejects malformed successful responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({
    recenttracks: { track: [{ name: 'Song', artist: null }] },
  }));

  await assert.rejects(getNowPlaying(config), /unexpected JSON response shape/);
});

test('marks documented temporary API failures as retryable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({
    error: 29,
    message: 'Rate limit exceeded',
  }));

  await assert.rejects(getNowPlaying(config), (error: unknown) => {
    assert.equal(isTransientError(error), true);
    return true;
  });
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
