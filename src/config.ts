const DEFAULT_UPDATE_INTERVAL_SECONDS = 30;
const MIN_UPDATE_INTERVAL_SECONDS = 10;

export interface Config {
  bluesky: {
    username: string;
    password: string;
  };
  lastfm: {
    apiKey: string;
    username: string;
  };
  updateIntervalMs: number;
}

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

  if (!Number.isFinite(seconds) || seconds < MIN_UPDATE_INTERVAL_SECONDS) {
    throw new Error(
      `UPDATE_INTERVAL must be a number >= ${MIN_UPDATE_INTERVAL_SECONDS} seconds. Received: ${value}`
    );
  }

  return Math.floor(seconds * 1000);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    bluesky: {
      username: requireEnv(env, 'BSKY_USERNAME'),
      password: requireEnv(env, 'BSKY_PASSWORD'),
    },
    lastfm: {
      apiKey: requireEnv(env, 'LASTFM_API_KEY'),
      username: requireEnv(env, 'LASTFM_USERNAME'),
    },
    updateIntervalMs: parseUpdateInterval(env.UPDATE_INTERVAL),
  };
}
