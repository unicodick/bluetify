const DEFAULT_UPDATE_INTERVAL_SECONDS = 30;
const MIN_UPDATE_INTERVAL_SECONDS = 10;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
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

export const config = {
  bluesky: {
    username: requireEnv('BSKY_USERNAME'),
    password: requireEnv('BSKY_PASSWORD'),
  },
  lastfm: {
    apiKey: requireEnv('LASTFM_API_KEY'),
    username: requireEnv('LASTFM_USERNAME'),
  },
  updateIntervalMs: parseUpdateInterval(process.env.UPDATE_INTERVAL),
} as const;

export type Config = typeof config;
