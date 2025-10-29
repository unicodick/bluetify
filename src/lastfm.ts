import { LastFm } from '@imikailoby/lastfm-ts';
import { config } from './config';
import { Track } from './musicService';
import { BaseMusicService } from './baseMusicService';
import { ErrorMessages } from './constants';

export class LastFmService extends BaseMusicService {
  private lastFm: LastFm;

  constructor() {
    super();
    this.lastFm = new LastFm(config.lastfm!.apiKey);
  }

  async initialize(): Promise<void> {
    try {
      await this.lastFm.user.getInfo({ user: config.lastfm!.username });
    } catch (error) {
      throw new Error(`${ErrorMessages.AUTH_FAILED} (Last.fm): ${error}`);
    }
  }

  async getCurrentTrack(): Promise<Track | null> {
    try {
      const response = await this.lastFm.user.getRecentTracks({
        user: config.lastfm!.username,
        limit: '1',
        extended: '1',
      });

      if (!response.recenttracks?.track?.length) {
        return null;
      }

      const track = response.recenttracks.track[0] as any;
      const isNowPlaying = track['@attr']?.nowplaying === 'true';

      if (!isNowPlaying) {
        return null;
      }

      const artistName = track.artist?.name || track.artist?.['#text'] || 'Unknown Artist';
      const albumName = track.album?.['#text'] || 'Unknown Album';
      const trackName = track.name || 'Unknown Track';

      return {
        name: trackName,
        artist: artistName,
        album: albumName,
        isPlaying: true,
      };
    } catch (error) {
      throw new Error(`Failed to fetch Last.fm track: ${error}`);
    }
  }
}
