import dotenv from 'dotenv';

dotenv.config();

export type MusicService = 'spotify' | 'lastfm';

export interface Config {
  musicService: MusicService;
  spotify?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  bluesky: {
    username: string;
    password: string;
  };
  lastfm?: {
    apiKey: string;
    username: string;
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

const musicService = requireEnv('MUSIC_SERVICE').toLowerCase() as MusicService;

if (!['spotify', 'lastfm'].includes(musicService)) {
  throw new Error(`invalid MUSIC_SERVICE: ${musicService}.`);
}

const serviceConfigs = {
  spotify: () => ({
    clientId: requireEnv('SPOTIFY_CLIENT_ID'),
    clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
    refreshToken: requireEnv('SPOTIFY_REFRESH_TOKEN'),
  }),
  lastfm: () => ({
    apiKey: requireEnv('LASTFM_API_KEY'),
    username: requireEnv('LASTFM_USERNAME'),
  }),
};

export const config: Config = {
  musicService,
  spotify: musicService === 'spotify' ? serviceConfigs.spotify() : undefined,
  lastfm: musicService === 'lastfm' ? serviceConfigs.lastfm() : undefined,
  bluesky: {
    username: requireEnv('BSKY_USERNAME'),
    password: requireEnv('BSKY_PASSWORD'),
  },
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || '30') * 1000,
};
