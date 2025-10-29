export const BLUESKY_SERVICE_URL = 'https://bsky.social';
export const BLUESKY_BIO_MAX_LENGTH = 256;
export const DEFAULT_UPDATE_INTERVAL_SECONDS = 30;
export const SPOTIFY_MAX_RETRY_ATTEMPTS = 3;

export const ErrorMessages = {
  ENV_REQUIRED: (name: string) => `Environment variable ${name} is required`,
  INVALID_MUSIC_SERVICE: (service: string) => `Invalid MUSIC_SERVICE: ${service}. Must be 'spotify' or 'lastfm'`,
  INIT_FAILED: 'Failed to initialize service',
  AUTH_FAILED: 'Authentication failed',
  SHUTDOWN_FAILED: 'Failed to shutdown gracefully',
  BIO_RESTORE_FAILED: 'Failed to restore original bio',
  TRACK_CHECK_FAILED: 'Failed to check current track',
  PROFILE_UPDATE_FAILED: 'Failed to update profile',
} as const;

export const LogMessages = {
  INIT_SUCCESS: (service: string) => `Bluetify initialized with ${service}`,
  NOW_PLAYING: (track: string, artist: string) => `Now playing: ${track} - ${artist}`,
  SHUTDOWN_COMPLETE: 'Shutdown complete',
} as const;
