import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  spotify: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  bluesky: {
    username: string;
    password: string;
  };
  updateInterval: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`env ${name} is required`);
  }
  return value;
}

export const config: Config = {
  spotify: {
    clientId: requireEnv('SPOTIFY_CLIENT_ID'),
    clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
    refreshToken: requireEnv('SPOTIFY_REFRESH_TOKEN'),
  },
  bluesky: {
    username: requireEnv('BSKY_USERNAME'),
    password: requireEnv('BSKY_PASSWORD'),
  },
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || '30') * 1000,
};
