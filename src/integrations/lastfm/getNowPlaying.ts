import { Config } from '../../config/index.js';
import {
  HTTP_ERROR_BODY_PREVIEW_MAX_LENGTH,
  HTTP_REQUEST_TIMEOUT_MS,
  HttpResponseError,
  fetchWithTimeout,
  parseRetryAfter,
  parseJsonOrNull,
} from '../../core/index.js';
import { Track } from '../../domain/index.js';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

interface LastFmTrack {
  name: string;
  artist: { '#text': string } | string;
  '@attr'?: { nowplaying?: string };
}

interface LastFmResponse {
  recenttracks: {
    track: LastFmTrack | LastFmTrack[];
  };
}

class LastFmApiError extends Error {
  readonly retryable: boolean;

  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(`last.fm API error ${code}: ${message}`);
    this.name = 'LastFmApiError';
    this.retryable = code === 11 || code === 16 || code === 29;
  }
}

function mapNowPlaying(response: LastFmResponse): Track | null {
  const tracks = response.recenttracks.track;

  const track = Array.isArray(tracks) ? tracks[0] : tracks;
  if (!track || track['@attr']?.nowplaying !== 'true') return null;

  return {
    name: track.name || 'Unknown Track',
    artist: typeof track.artist === 'string'
      ? track.artist || 'Unknown Artist'
      : track.artist['#text'] || 'Unknown Artist',
  };
}

export async function getNowPlaying(
  config: Config,
  signal?: AbortSignal,
): Promise<Track | null> {
  const params = new URLSearchParams({
    method: 'user.getrecenttracks',
    user: config.lastfm.username,
    api_key: config.lastfm.apiKey,
    format: 'json',
    limit: '1',
  });

  const response = await fetchWithTimeout(
    'last.fm user.getrecenttracks',
    HTTP_REQUEST_TIMEOUT_MS,
    `${LASTFM_API_URL}?${params}`,
    { signal },
  );
  const rawBody = await response.text();

  if (!response.ok) {
    const fallbackBody = rawBody.trim().slice(0, HTTP_ERROR_BODY_PREVIEW_MAX_LENGTH) || '<empty body>';
    throw new HttpResponseError(
      `last.fm request failed: ${response.status} ${response.statusText}. body: ${fallbackBody}`,
      response.status,
      parseRetryAfter(response.headers.get('retry-after')),
    );
  }

  const data = parseJsonOrNull<unknown>(rawBody);
  if (data === null) {
    throw new Error(`last.fm request failed: invalid JSON response (HTTP ${response.status})`);
  }

  if (isLastFmError(data)) {
    throw new LastFmApiError(data.error, data.message);
  }
  if (!isLastFmResponse(data)) {
    throw new Error('last.fm request failed: unexpected JSON response shape');
  }

  return mapNowPlaying(data);
}

function isLastFmError(value: unknown): value is { error: number; message: string } {
  return (
    isRecord(value) &&
    typeof value.error === 'number' &&
    typeof value.message === 'string'
  );
}

function isLastFmResponse(value: unknown): value is LastFmResponse {
  if (!isRecord(value) || !isRecord(value.recenttracks)) return false;
  const tracks = value.recenttracks.track;
  if (Array.isArray(tracks)) return tracks.every(isLastFmTrack);
  return isLastFmTrack(tracks);
}

function isLastFmTrack(value: unknown): value is LastFmTrack {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  const artist = value.artist;
  if (
    typeof artist !== 'string' &&
    (!isRecord(artist) || typeof artist['#text'] !== 'string')
  ) return false;

  return (
    value['@attr'] === undefined ||
    (isRecord(value['@attr']) &&
      (value['@attr'].nowplaying === undefined ||
        typeof value['@attr'].nowplaying === 'string'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
