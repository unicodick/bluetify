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
  recenttracks?: {
    track?: LastFmTrack | LastFmTrack[];
  };
  error?: number;
  message?: string;
}

function getArtistName(artist: LastFmTrack['artist']): string {
  return typeof artist === 'string' ? artist : artist['#text'];
}

function mapNowPlaying(response: LastFmResponse): Track | null {
  const tracks = response.recenttracks?.track;
  if (!tracks) return null;

  const track = Array.isArray(tracks) ? tracks[0] : tracks;
  if (!track || track['@attr']?.nowplaying !== 'true') return null;

  return {
    name: track.name || 'Unknown Track',
    artist: getArtistName(track.artist) || 'Unknown Artist',
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

  const data = parseJsonOrNull<LastFmResponse>(rawBody);
  if (data === null) {
    throw new Error(`last.fm request failed: invalid JSON response (HTTP ${response.status})`);
  }

  if (data.error) {
    throw new Error(`last.fm API error ${data.error}: ${data.message}`);
  }

  return mapNowPlaying(data);
}
