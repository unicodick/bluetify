import { LastFm } from '@imikailoby/lastfm-ts';
import { config } from './config';
import { MusicService, Track } from './musicService';

export class LastFmService implements MusicService {
  private lastFm: LastFm;
  private lastTrackId: string | null = null;

  constructor() {
    this.lastFm = new LastFm(config.lastfm!.apiKey);
  }

  async initialize(): Promise<void> {
    try {
      await this.lastFm.user.getInfo({ user: config.lastfm!.username });
    } catch (error) {
      throw new Error(`lastfm auth failed: ${error}`);
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

      return {
        name: track.name || 'Unknown Track',
        artist: track.artist?.name || track.artist?.['#text'] || 'Unknown Artist',
        album: track.album?.['#text'] || 'Unknown Album',
        isPlaying: isNowPlaying,
      };
    } catch (error) {
      throw error;
    }
  }

  hasTrackChanged(currentTrack: Track | null): boolean {
    const trackId = currentTrack ? `${currentTrack.name}|${currentTrack.artist}` : null;
    const changed = this.lastTrackId !== trackId;
    this.lastTrackId = trackId;
    return changed;
  }

  formatTrackForBio(track: Track): string {
    return `Now playing: ${track.name} by ${track.artist}`;
  }
}
