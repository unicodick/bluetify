import { Config } from './types.js';
import { BLUESKY_SERVICE_URL } from '../core/index.js';

const DEFAULT_UPDATE_INTERVAL_SECONDS = 30;
const MIN_UPDATE_INTERVAL_SECONDS = 10;
const MAX_UPDATE_INTERVAL_SECONDS = 86_400;
const DEFAULT_STATE_FILE = '.bluetify-state.json';

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`env ${name} is required`);
  }
  return value;
}

function parseUpdateInterval(raw: string | undefined): number {
  const value = raw?.trim() ?? String(DEFAULT_UPDATE_INTERVAL_SECONDS);
  const seconds = Number(value);

  if (
    !Number.isFinite(seconds) ||
    seconds < MIN_UPDATE_INTERVAL_SECONDS ||
    seconds > MAX_UPDATE_INTERVAL_SECONDS
  ) {
    throw new Error(
      `UPDATE_INTERVAL must be between ${MIN_UPDATE_INTERVAL_SECONDS} and ${MAX_UPDATE_INTERVAL_SECONDS} seconds. Received: ${value}`
    );
  }

  return Math.floor(seconds * 1000);
}

function parseBlueskyServiceUrl(raw: string | undefined): string {
  const value = raw?.trim() || BLUESKY_SERVICE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`BSKY_SERVICE_URL must be a valid HTTPS URL. Received: ${value}`);
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`BSKY_SERVICE_URL must be an HTTPS origin. Received: ${value}`);
  }
  return url.origin;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    bluesky: {
      username: requireEnv(env, 'BSKY_USERNAME'),
      password: requireEnv(env, 'BSKY_PASSWORD'),
      serviceUrl: parseBlueskyServiceUrl(env.BSKY_SERVICE_URL),
    },
    lastfm: {
      apiKey: requireEnv(env, 'LASTFM_API_KEY'),
      username: requireEnv(env, 'LASTFM_USERNAME'),
    },
    stateFile: env.BLUETIFY_STATE_FILE?.trim() || DEFAULT_STATE_FILE,
    updateIntervalMs: parseUpdateInterval(env.UPDATE_INTERVAL),
  };
}
