import { config } from './config.js';
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

  const response = await fetch(`${LASTFM_API_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`last.fm request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as LastFmResponse;

  if (data.error) {
    throw new Error(`last.fm API error ${data.error}: ${data.message}`);
  }

  return mapNowPlaying(data);
}
