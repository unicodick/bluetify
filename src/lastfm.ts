import { config } from './config.js';
import { HTTP_REQUEST_TIMEOUT_MS } from './constants.js';
import { fetchWithTimeout } from './http.js';
import { Track } from './types.js';

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

function parseJsonOrNull<T>(rawBody: string): T | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
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

export async function getNowPlaying(): Promise<Track | null> {
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
  );
  const rawBody = await response.text();

  if (!response.ok) {
    const fallbackBody = rawBody.trim().slice(0, 300) || '<empty body>';
    throw new Error(
      `last.fm request failed: ${response.status} ${response.statusText}. body: ${fallbackBody}`,
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
