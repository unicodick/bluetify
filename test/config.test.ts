import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config/index.js';

const validEnv: NodeJS.ProcessEnv = {
  BSKY_USERNAME: 'alice.test',
  BSKY_PASSWORD: 'app-password',
  LASTFM_API_KEY: 'key',
  LASTFM_USERNAME: 'alice',
};

test('loads safe defaults', () => {
  const config = loadConfig(validEnv);
  assert.equal(config.bluesky.serviceUrl, 'https://bsky.social');
  assert.equal(config.stateFile, '.bluetify-state.json');
  assert.equal(config.updateIntervalMs, 30_000);
});

test('rejects timer-overflowing polling intervals', () => {
  assert.throws(
    () => loadConfig({ ...validEnv, UPDATE_INTERVAL: '3000000' }),
    /must be between 10 and 86400/,
  );
});

test('rejects insecure Bluesky service URLs', () => {
  assert.throws(
    () => loadConfig({ ...validEnv, BSKY_SERVICE_URL: 'http://pds.test' }),
    /must be an HTTPS origin/,
  );
});

test('accepts a custom PDS origin', () => {
  const config = loadConfig({
    ...validEnv,
    BSKY_SERVICE_URL: 'https://pds.example.com/',
  });
  assert.equal(config.bluesky.serviceUrl, 'https://pds.example.com');
});
