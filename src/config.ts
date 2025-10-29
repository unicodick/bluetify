import dotenv from 'dotenv';
import { DEFAULT_UPDATE_INTERVAL_SECONDS, ErrorMessages } from './constants';

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
  if (!value || value.trim() === '') {
    throw new Error(ErrorMessages.ENV_REQUIRED(name));
  }
  return value.trim();
}

const musicServiceRaw = requireEnv('MUSIC_SERVICE').toLowerCase().trim() as MusicService;

if (!['spotify', 'lastfm'].includes(musicServiceRaw)) {
  throw new Error(ErrorMessages.INVALID_MUSIC_SERVICE(musicServiceRaw));
}

const musicService: MusicService = musicServiceRaw;

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
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || String(DEFAULT_UPDATE_INTERVAL_SECONDS)) * 1000,
};
